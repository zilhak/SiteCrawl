/**
 * Pipeline 실행 엔진
 *
 * DAG 위상 정렬 순서로 Task를 실행하고,
 * Task 간 데이터를 불변 원칙에 따라 전달한다.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import type { Pipeline } from '../types'
import type { DAGNode } from '../types'
import { DAG } from '../dag'
import { PipelineValidator } from '../validator'
import type { PipelineTaskCategory } from '../types'
import type {
  TaskData,
  NodeExecutionResult,
  ExecutionProgressEvent,
  PipelineExecutionResult
} from './types'
import { TASK_IO_MAP } from './types'
import { ResultStore } from './result'

export interface EngineDependencies {
  onProgress: (event: ExecutionProgressEvent) => void
  saveStrings?: (pipelineId: string, executionId: string, strings: string[], deduplication: boolean) => void
}

export class PipelineExecutionEngine {
  private onProgress: (event: ExecutionProgressEvent) => void
  private saveStringsFn?: (pipelineId: string, executionId: string, strings: string[], deduplication: boolean) => void
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private currentPipelineId: string = ''
  private currentExecutionId: string = ''
  private resultStore: ResultStore = new ResultStore()

  constructor(deps: EngineDependencies) {
    this.onProgress = deps.onProgress
    this.saveStringsFn = deps.saveStrings
  }

  /**
   * 파이프라인 실행 (Process → Final 2단계)
   */
  async execute(
    pipeline: Pipeline,
    initialUrl: string,
    executionId: string
  ): Promise<PipelineExecutionResult> {
    const startedAt = Date.now()
    const results: NodeExecutionResult[] = []
    this.currentPipelineId = pipeline.id
    this.currentExecutionId = executionId
    this.resultStore = new ResultStore()

    try {
      // 1. 검증
      const validator = new PipelineValidator()
      const validation = validator.validate(pipeline)
      if (!validation.valid) {
        return {
          executionId,
          pipelineId: pipeline.id,
          status: 'failed',
          results: [],
          error: `파이프라인 검증 실패: ${validation.errors.join(', ')}`,
          startedAt,
          completedAt: Date.now()
        }
      }

      // 2. 브라우저 초기화
      await this.initBrowser()

      // 3. _run_ 초기 페이지 이동 (진입점)
      const initialPage = await this.executeInitialNavigation(initialUrl)

      // 4. Process 구간 실행
      const processDAG = DAG.fromPipeline(pipeline, 'process')
      const processResult = await this.executePhase(processDAG, initialPage, executionId)
      results.push(...processResult.results)

      // 5. Final 구간 실행 (Process 완료 후)
      const finalDAG = DAG.fromPipeline(pipeline, 'final')
      if (finalDAG.getRoot()) {
        const finalResult = await this.executePhase(finalDAG, initialPage, executionId)
        results.push(...finalResult.results)
      }

      // 6. 최종 상태 결정
      const allSuccess = results.every(r => r.success)
      const allFailed = results.every(r => !r.success)
      const status = allSuccess ? 'completed' : allFailed ? 'failed' : 'partially_failed'

      return {
        executionId,
        pipelineId: pipeline.id,
        status,
        results,
        startedAt,
        completedAt: Date.now()
      }
    } catch (error) {
      return {
        executionId,
        pipelineId: pipeline.id,
        status: 'failed',
        results,
        error: error instanceof Error ? error.message : 'Unknown error',
        startedAt,
        completedAt: Date.now()
      }
    } finally {
      await this.closeBrowser()
    }
  }

  /**
   * 단일 구간(phase) 실행
   */
  private async executePhase(
    dag: DAG,
    initialPage: Page,
    executionId: string
  ): Promise<{ results: NodeExecutionResult[], nodeOutputs: Map<string, TaskData> }> {
    const results: NodeExecutionResult[] = []
    const nodeOutputs = new Map<string, TaskData>()
    const failedNodes = new Set<string>()
    const executionOrder = dag.topologicalSort()

    for (const node of executionOrder) {
      // 부모가 실패했으면 이 노드도 스킵
      if (this.isAncestorFailed(node, dag, failedNodes)) {
        failedNodes.add(node.name)
        results.push({
          taskName: node.name,
          taskId: node.taskId || node.name,
          success: false,
          output: null,
          error: '상위 Task 실패로 인해 건너뜀',
          startedAt: Date.now(),
          completedAt: Date.now()
        })
        continue
      }

      // 진행 이벤트 발행
      this.emitProgress(executionId, node, 'running', '실행 중...')

      // 부모 출력 가져오기
      const parentOutput = this.getParentOutput(node, nodeOutputs, initialPage)

      // 입력 타입 어댑팅
      const adaptedInput = this.adaptInput(parentOutput, node.category)

      // Task 실행 (인라인 config 사용)
      const result = await this.executeTask(node.category, node.taskConfig, adaptedInput, node)
      results.push(result)

      // result_save는 output이 null이어도 성공
      if (result.success) {
        if (result.output) {
          nodeOutputs.set(node.name, result.output)
        }
        this.emitProgress(executionId, node, 'completed', '완료')
      } else {
        failedNodes.add(node.name)
        this.emitProgress(executionId, node, 'failed', result.error || '실행 실패')
      }
    }

    return { results, nodeOutputs }
  }

  /**
   * 개별 Task 실행 (인라인 config 기반)
   */
  private async executeTask(
    category: PipelineTaskCategory,
    taskConfig: Record<string, unknown>,
    input: TaskData,
    node: DAGNode
  ): Promise<NodeExecutionResult> {
    const startedAt = Date.now()
    const taskId = node.taskId || node.name

    try {
      let output: TaskData | null

      switch (category) {
        case 'string_filter':
          output = await this.executeStringFilter(taskConfig, input)
          break
        case 'page_navigation':
          output = await this.executePageNavigation(taskConfig, input)
          break
        case 'link_extraction':
          output = await this.executeLinkExtraction(taskConfig, input)
          break
        case 'resource_extraction':
          output = await this.executeResourceExtraction(taskConfig, input)
          break
        case 'string_db_save':
          output = await this.executeStringDbSave(taskConfig, input)
          break
        case 'string_display':
          output = await this.executeStringDisplay(taskConfig, input)
          break
        case 'result_save':
          output = await this.executeResultSave(taskConfig, input)
          break
        default:
          throw new Error(`알 수 없는 Task 카테고리: ${category}`)
      }

      return {
        taskName: node.name,
        taskId,
        category,
        success: true,
        output,
        startedAt,
        completedAt: Date.now()
      }
    } catch (error) {
      return {
        taskName: node.name,
        taskId,
        category,
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        startedAt,
        completedAt: Date.now()
      }
    }
  }

  /**
   * 문자열 필터링 태스크: string[] → string[]
   * config: { mode, regex?, wildcards?, limit? }
   */
  private async executeStringFilter(
    config: Record<string, unknown>,
    input: TaskData
  ): Promise<TaskData> {
    if (input.type !== 'strings') {
      throw new Error(`StringFilterTask는 strings 입력이 필요합니다. 받은 타입: ${input.type}`)
    }

    let result = [...input.value] // 불변: 새 배열 생성

    // 인라인 필터 적용 (mode + regex + wildcards)
    const mode = config.mode as string
    const regex = config.regex as string | undefined
    const wildcards = config.wildcards as string[] | undefined

    if (mode && (regex || (wildcards && wildcards.length > 0))) {
      result = PipelineExecutionEngine.applyFilter(result, mode, regex, wildcards)
    }

    // Limit 적용
    const limit = (config.limit as number) ?? -1
    if (limit >= 0) {
      result = result.slice(0, limit)
    }

    return { type: 'strings', value: result }
  }

  /**
   * 페이지 이동 태스크: string(url) → Page
   */
  private async executePageNavigation(
    config: Record<string, unknown>,
    input: TaskData
  ): Promise<TaskData> {
    let targetUrl: string

    if (input.type === 'url') {
      targetUrl = input.value
    } else if (input.type === 'strings' && input.value.length > 0) {
      targetUrl = input.value[0]
    } else {
      throw new Error(`PageNavigationTask는 url 또는 strings 입력이 필요합니다. 받은 타입: ${input.type}`)
    }

    if (!this.context) {
      throw new Error('브라우저가 초기화되지 않았습니다.')
    }

    const page = await this.context.newPage()

    await page.goto(targetUrl, {
      waitUntil: (config.waitUntil as 'domcontentloaded' | 'load' | 'networkidle') || 'domcontentloaded',
      timeout: (config.timeout as number) || 30000
    })

    // 쿠키 동의 팝업 처리
    if (config.handleCookies) {
      await this.handleCookieConsent(page)
    }

    return { type: 'page', value: page }
  }

  /**
   * 링크 추출 태스크: Page → URL[]
   */
  private async executeLinkExtraction(
    config: Record<string, unknown>,
    input: TaskData
  ): Promise<TaskData> {
    if (input.type !== 'page') {
      throw new Error(`LinkExtractionTask는 page 입력이 필요합니다. 받은 타입: ${input.type}`)
    }

    const page = input.value
    const pageUrl = page.url()
    const baseUrl = new URL(pageUrl)
    const baseDomain = baseUrl.hostname
    const links: string[] = []

    // href 링크 추출
    if (config.includeHrefLinks) {
      const hrefLinks = await page.$$eval('a[href]', (elements, baseHref) => {
        return elements
          .map((el) => {
            const href = el.getAttribute('href')
            if (!href || href === '' || href === '#' || href.startsWith('#')) return null
            if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return null
            try {
              return new URL(href, baseHref).href
            } catch {
              return null
            }
          })
          .filter((href): href is string => href !== null)
      }, pageUrl)

      links.push(...hrefLinks)
    }

    // 본문 텍스트 내 URL 추출
    if (config.includeTextUrls) {
      const textContent = await page.evaluate(() => document.body.innerText)
      const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi
      const textUrls = textContent.match(urlRegex) || []
      links.push(...textUrls)
    }

    // 경로 유형 필터링
    let filtered = [...new Set(links)] // 불변: 새 배열 + 중복 제거
    filtered = filtered.filter(link => {
      try {
        const linkUrl = new URL(link)
        const isInternal = linkUrl.hostname === baseDomain
        if (isInternal) return !!config.includeRelativePaths
        return !!config.includeAbsolutePaths
      } catch {
        return false
      }
    })

    // 인라인 사후 필터 적용
    const postFilterMode = config.postFilterMode as string | undefined
    const postFilterRegex = config.postFilterRegex as string | undefined
    const postFilterWildcards = config.postFilterWildcards as string[] | undefined

    if (postFilterMode && (postFilterRegex || (postFilterWildcards && postFilterWildcards.length > 0))) {
      filtered = PipelineExecutionEngine.applyFilter(filtered, postFilterMode, postFilterRegex, postFilterWildcards)
    }

    // Page 닫기 (리소스 정리)
    await page.close()

    return { type: 'urls', value: filtered }
  }

  /**
   * 리소스 추출 태스크: URL[] → URL[]
   */
  private async executeResourceExtraction(
    config: Record<string, unknown>,
    input: TaskData
  ): Promise<TaskData> {
    if (input.type !== 'urls' && input.type !== 'strings') {
      throw new Error(`ResourceExtractionTask는 urls 또는 strings 입력이 필요합니다. 받은 타입: ${input.type}`)
    }

    // 리소스 타입별 확장자 매핑
    const extensionMap: Record<string, string[]> = {
      image: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp'],
      pdf: ['.pdf'],
      video: ['.mp4', '.webm', '.avi', '.mov', '.mkv'],
      css: ['.css'],
      js: ['.js', '.mjs']
    }

    const resourceTypes = (config.resourceTypes as string[]) || []
    const allowedExtensions = resourceTypes.flatMap(
      type => extensionMap[type] || []
    )

    // 불변: 새 배열 생성
    let result = input.value.filter(url => {
      try {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname.toLowerCase()
        return allowedExtensions.some(ext => pathname.endsWith(ext))
      } catch {
        return false
      }
    })

    // 인라인 필터 적용
    const filterMode = config.filterMode as string | undefined
    const filterRegex = config.filterRegex as string | undefined
    const filterWildcards = config.filterWildcards as string[] | undefined

    if (filterMode && (filterRegex || (filterWildcards && filterWildcards.length > 0))) {
      result = PipelineExecutionEngine.applyFilter(result, filterMode, filterRegex, filterWildcards)
    }

    return { type: 'urls', value: result }
  }

  /**
   * 문자열 DB 저장 태스크: string[] → string[] (pass-through)
   * Final 구간에서는 config.resultIndex로 Result에서 데이터를 읽을 수 있다.
   */
  private async executeStringDbSave(
    config: Record<string, unknown>,
    input: TaskData
  ): Promise<TaskData> {
    // Result에서 읽기 (config에 resultIndex가 있으면)
    let data: TaskData = input
    if (config.resultIndex !== undefined) {
      const resultData = this.readFromResult(config.resultIndex as number | 'all')
      if (resultData) data = resultData
    }

    if (data.type !== 'strings' && data.type !== 'urls') {
      throw new Error(`StringDbSaveTask는 strings 입력이 필요합니다. 받은 타입: ${data.type}`)
    }

    const deduplication = (config.deduplication as boolean) ?? false
    const values = [...data.value]

    // DB에 저장
    if (this.saveStringsFn) {
      this.saveStringsFn(this.currentPipelineId, this.currentExecutionId, values, deduplication)
    }

    // pass-through (불변 원칙)
    return { type: 'strings', value: values }
  }

  /**
   * 문자열 화면 표시 태스크: string[] → string[] (pass-through)
   * Final 구간에서는 config.resultIndex로 Result에서 데이터를 읽을 수 있다.
   */
  private async executeStringDisplay(
    config: Record<string, unknown>,
    input: TaskData
  ): Promise<TaskData> {
    // Result에서 읽기 (config에 resultIndex가 있으면)
    let data: TaskData = input
    if (config.resultIndex !== undefined) {
      const resultData = this.readFromResult(config.resultIndex as number | 'all')
      if (resultData) data = resultData
    }

    if (data.type !== 'strings' && data.type !== 'urls') {
      throw new Error(`StringDisplayTask는 strings 입력이 필요합니다. 받은 타입: ${data.type}`)
    }

    // pass-through (불변 원칙)
    // 프론트엔드에서 category === 'string_display'인 결과를 특별히 렌더링
    return { type: 'strings', value: [...data.value] }
  }

  /**
   * Result 저장 태스크: input → Result에 저장 (터미널, 출력 없음)
   */
  private async executeResultSave(
    config: Record<string, unknown>,
    input: TaskData
  ): Promise<null> {
    const targetIndex = (config.targetIndex as number) ?? -1

    if (targetIndex === -1) {
      this.resultStore.append(input)
    } else {
      this.resultStore.set(targetIndex, input)
    }

    return null  // 터미널: 출력 없음
  }

  /**
   * ResultStore에서 데이터 읽기 헬퍼
   */
  private readFromResult(index: number | 'all'): TaskData | null {
    if (index === 'all') {
      // Result 전체를 strings로 평탄화
      const all = this.resultStore.getAll()
      const flattened: string[] = []
      for (const item of all) {
        if (item.type === 'strings' || item.type === 'urls') {
          flattened.push(...item.value)
        } else if (item.type === 'url') {
          flattened.push(item.value)
        }
      }
      return { type: 'strings', value: flattened }
    }

    return this.resultStore.get(index)
  }

  /**
   * 부모 노드의 출력 가져오기
   */
  private getParentOutput(
    node: DAGNode,
    nodeOutputs: Map<string, TaskData>,
    initialPage: Page
  ): TaskData {
    // Process 루트 노드: _run_ 이 수행한 페이지 이동 결과 (Page 객체)
    if (node.trigger === '_run_') {
      return { type: 'page', value: initialPage }
    }

    // Final 루트 노드: _final_ 은 Empty 타입 출력
    if (node.trigger === '_final_') {
      return { type: 'empty', value: null }
    }

    // 부모 노드의 출력
    const parentOutput = nodeOutputs.get(node.trigger)
    if (!parentOutput) {
      throw new Error(`부모 Task '${node.trigger}'의 출력을 찾을 수 없습니다.`)
    }

    return parentOutput
  }

  /**
   * 입력 타입 어댑팅
   */
  private adaptInput(
    parentOutput: TaskData,
    targetCategory: string
  ): TaskData {
    const expected = TASK_IO_MAP[targetCategory as keyof typeof TASK_IO_MAP]
    if (!expected) return parentOutput

    const expectedInput = expected.input

    // Empty 타입: 대상 Task의 기대 입력에 맞는 빈 값으로 변환
    if (parentOutput.type === 'empty') {
      switch (expectedInput) {
        case 'strings': return { type: 'strings', value: [] }
        case 'urls': return { type: 'urls', value: [] }
        case 'url': return { type: 'url', value: '' }
        default: throw new Error(`Empty에서 '${expectedInput}' 타입으로 변환할 수 없습니다.`)
      }
    }

    // 정확히 일치하면 복사만 (불변 원칙)
    if (parentOutput.type === expectedInput) {
      if (parentOutput.type === 'strings' || parentOutput.type === 'urls') {
        return { type: parentOutput.type, value: [...parentOutput.value] }
      }
      return parentOutput
    }

    // urls → strings: 호환 (urls IS strings)
    if (parentOutput.type === 'urls' && expectedInput === 'strings') {
      return { type: 'strings', value: [...parentOutput.value] }
    }

    // strings → urls: URL 유효성 검증을 거쳐 변환
    if (parentOutput.type === 'strings' && expectedInput === 'urls') {
      return { type: 'urls', value: PipelineExecutionEngine.validateUrls(parentOutput.value) }
    }

    // url → strings: 배열로 래핑
    if (parentOutput.type === 'url' && expectedInput === 'strings') {
      return { type: 'strings', value: [parentOutput.value] }
    }

    // url → urls: 배열로 래핑
    if (parentOutput.type === 'url' && expectedInput === 'urls') {
      return { type: 'urls', value: [parentOutput.value] }
    }

    // urls → url: 첫 번째 요소 사용
    if (parentOutput.type === 'urls' && expectedInput === 'url') {
      if (parentOutput.value.length === 0) {
        throw new Error('빈 URL 목록에서 URL을 가져올 수 없습니다.')
      }
      return { type: 'url', value: parentOutput.value[0] }
    }

    // strings → url: 첫 번째 요소 사용
    if (parentOutput.type === 'strings' && expectedInput === 'url') {
      if (parentOutput.value.length === 0) {
        throw new Error('빈 목록에서 URL을 가져올 수 없습니다.')
      }
      return { type: 'url', value: parentOutput.value[0] }
    }

    // 호환 불가능한 타입 조합
    throw new Error(
      `타입 불일치: '${parentOutput.type}' → '${expectedInput}' 변환 불가. ` +
      `중간에 적절한 Task를 추가해주세요.`
    )
  }

  /**
   * 상위 노드가 실패했는지 확인
   */
  private isAncestorFailed(
    node: DAGNode,
    dag: DAG,
    failedNodes: Set<string>
  ): boolean {
    if (node.trigger === '_run_' || node.trigger === '_final_') return false
    if (failedNodes.has(node.trigger)) return true

    // 부모의 부모도 재귀적으로 확인
    const parentNode = dag.getNode(node.trigger)
    if (parentNode) {
      return this.isAncestorFailed(parentNode, dag, failedNodes)
    }
    return false
  }

  /**
   * 브라우저 초기화
   */
  private async initBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox']
    })
    this.context = await this.browser.newContext()
  }

  /**
   * _run_ 초기 페이지 이동 (진입점)
   * 사용자가 입력한 URL로 이동하여 Page 객체를 반환
   */
  private async executeInitialNavigation(initialUrl: string): Promise<Page> {
    if (!this.context) {
      throw new Error('브라우저가 초기화되지 않았습니다.')
    }

    const page = await this.context.newPage()
    await page.goto(initialUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    // 쿠키 동의 팝업 처리
    await this.handleCookieConsent(page)

    return page
  }

  /**
   * 브라우저 종료
   */
  private async closeBrowser(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {})
      this.context = null
    }
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
  }

  /**
   * 쿠키 동의 팝업 자동 처리 (crawler.ts에서 가져옴)
   */
  private async handleCookieConsent(page: Page): Promise<void> {
    const cookieSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept all")',
      'button:has-text("Accept All")',
      'button:has-text("I agree")',
      'button:has-text("Agree")',
      'button:has-text("OK")',
      'button:has-text("Got it")',
      'button:has-text("Allow")',
      'button:has-text("Allow all")',
      '#cookie-accept',
      '#accept-cookies',
      '.cookie-accept',
      '.accept-cookies',
      'button[aria-label*="accept" i]',
      'button[aria-label*="cookie" i]'
    ]

    for (const selector of cookieSelectors) {
      try {
        const button = await page.$(selector)
        if (button) {
          const isVisible = await button.isVisible()
          if (isVisible) {
            await button.click({ timeout: 2000 })
            await page.waitForTimeout(500)
            return
          }
        }
      } catch {
        continue
      }
    }
  }

  /**
   * 문자열 배열에서 유효한 URL만 필터링하여 반환
   */
  private static validateUrls(strings: string[]): string[] {
    return strings.filter(s => {
      try {
        new URL(s)
        return true
      } catch {
        return false
      }
    })
  }

  /**
   * 인라인 필터 적용 (FilterEngine 대체)
   */
  private static applyFilter(
    input: string[],
    mode: string,
    regex?: string,
    wildcards?: string[]
  ): string[] {
    return input.filter(item => {
      const matches = PipelineExecutionEngine.matchesFilter(item, regex, wildcards)
      return mode === 'whitelist' ? matches : !matches
    })
  }

  private static matchesFilter(item: string, regex?: string, wildcards?: string[]): boolean {
    if (!regex && (!wildcards || wildcards.length === 0)) return false

    if (regex) {
      try {
        if (new RegExp(regex, 'i').test(item)) return true
      } catch { /* invalid regex, skip */ }
    }

    if (wildcards && wildcards.length > 0) {
      for (const pattern of wildcards) {
        const regexPattern = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
        if (new RegExp(`^${regexPattern}$`, 'i').test(item)) return true
      }
    }

    return false
  }

  /**
   * 진행 이벤트 발행
   */
  private emitProgress(
    executionId: string,
    node: DAGNode,
    status: 'running' | 'completed' | 'failed',
    message: string
  ): void {
    this.onProgress({
      executionId,
      taskName: node.name,
      taskId: node.taskId || node.name,
      status,
      message,
      timestamp: Date.now()
    })
  }
}
