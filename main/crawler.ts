import { BrowserWindow, app } from 'electron'
import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

export interface CrawlResult {
  url: string
  title: string
  description: string
  screenshot: string
  links: string[]
  timestamp: number
}

export interface LoginOptions {
  url: string
  username?: string
  password?: string
  usernameSelector?: string
  passwordSelector?: string
  submitSelector?: string
  useSession?: boolean  // 저장된 세션 사용
  saveSession?: boolean // 세션 저장
}

export interface DomainFilter {
  mode: 'whitelist' | 'blacklist'
  patterns: string[]
}

export interface DomainSettings {
  [domain: string]: DomainFilter
}

export interface CrawlOptions {
  includeAbsolutePaths?: boolean  // 외부 링크 (절대 경로)
  includeRelativePaths?: boolean  // 내부 링크 (상대 경로)
  domainSettings?: DomainSettings // 도메인별 필터 설정
}

export class Crawler {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private window: BrowserWindow
  private sessionDir: string

  constructor(window: BrowserWindow) {
    this.window = window
    // 세션 저장 디렉토리 (userData 폴더 내)
    this.sessionDir = path.join(app.getPath('userData'), 'browser-sessions')
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true })
    }
  }

  async start(url: string, useSession: boolean = false, options?: CrawlOptions): Promise<CrawlResult> {
    try {
      this.sendProgress('브라우저 실행 중...')
      this.browser = await chromium.launch({
        headless: true,
        args: ['--disable-dev-shm-usage', '--no-sandbox']
      })

      // 세션 사용 여부에 따라 Context 생성
      if (useSession) {
        const sessionPath = this.getSessionPath(new URL(url).hostname)
        if (fs.existsSync(sessionPath)) {
          this.sendProgress('저장된 세션 불러오는 중...')
          this.context = await this.browser.newContext({
            storageState: sessionPath
          })
        } else {
          this.context = await this.browser.newContext()
        }
      } else {
        this.context = await this.browser.newContext()
      }

      this.sendProgress('페이지 로딩 중...')
      const page = await this.context.newPage()

      // domcontentloaded: DOM 로드 즉시 (가장 빠름)
      // load: 이미지 등 리소스 로드 완료 (중간)
      // networkidle: 모든 네트워크 완료 (느림)
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10000  // 10초 타임아웃
      })

      // 쿠키 동의 팝업 자동 처리
      await this.handleCookieConsent(page)

      this.sendProgress('데이터 추출 중...')
      const data = await this.extractData(page, url, options)

      this.sendProgress('스크린샷 촬영 중...')
      const screenshot = await this.takeScreenshot(page)

      this.sendProgress('완료!')
      return { ...data, screenshot }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`크롤링 실패: ${errorMessage}`)
    } finally {
      if (this.context) {
        await this.context.close()
        this.context = null
      }
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    }
  }

  // 자동 로그인 (ID/PW 입력)
  async login(options: LoginOptions): Promise<void> {
    try {
      this.sendProgress('로그인 시작...')
      this.browser = await chromium.launch({
        headless: true,
        args: ['--disable-dev-shm-usage', '--no-sandbox']
      })

      this.context = await this.browser.newContext()
      const page = await this.context.newPage()

      this.sendProgress('로그인 페이지 로딩 중...')
      await page.goto(options.url, { waitUntil: 'domcontentloaded' })

      // 쿠키 팝업 처리
      await this.handleCookieConsent(page)

      if (options.username && options.password) {
        this.sendProgress('로그인 정보 입력 중...')

        // 일반적인 셀렉터 또는 사용자 지정 셀렉터
        const userSelector = options.usernameSelector || 'input[type="email"], input[type="text"], input[name="username"], input[name="email"]'
        const passSelector = options.passwordSelector || 'input[type="password"]'
        const submitSelector = options.submitSelector || 'button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in")'

        await page.fill(userSelector, options.username)
        await page.fill(passSelector, options.password)

        this.sendProgress('로그인 버튼 클릭 중...')
        await page.click(submitSelector)

        // 로그인 완료 대기 (URL 변경 또는 특정 요소 확인)
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
          // 타임아웃 무시 (일부 사이트는 networkidle 안 됨)
        })
      }

      if (options.saveSession) {
        await this.saveCurrentSession(new URL(options.url).hostname)
      }

      this.sendProgress('로그인 완료!')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`로그인 실패: ${errorMessage}`)
    } finally {
      if (this.context) {
        await this.context.close()
        this.context = null
      }
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    }
  }

  // 수동 로그인 (브라우저 띄우기)
  async manualLogin(url: string): Promise<void> {
    try {
      this.sendProgress('수동 로그인 브라우저 실행 중...')
      this.browser = await chromium.launch({
        headless: false,  // 브라우저 화면 표시
        args: ['--disable-dev-shm-usage']
      })

      this.context = await this.browser.newContext()
      const page = await this.context.newPage()

      await page.goto(url, { waitUntil: 'domcontentloaded' })

      this.sendProgress('브라우저에서 직접 로그인해주세요...')
      this.sendProgress('로그인 후 이 메시지가 사라질 때까지 기다려주세요 (30초)')

      // 30초 대기 (사용자가 로그인할 시간)
      await page.waitForTimeout(30000)

      // 세션 저장
      await this.saveCurrentSession(new URL(url).hostname)

      this.sendProgress('세션이 저장되었습니다!')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`수동 로그인 실패: ${errorMessage}`)
    } finally {
      if (this.context) {
        await this.context.close()
        this.context = null
      }
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    }
  }

  // 현재 세션 저장
  private async saveCurrentSession(hostname: string): Promise<void> {
    if (!this.context) return

    this.sendProgress('세션 저장 중...')
    const sessionPath = this.getSessionPath(hostname)
    await this.context.storageState({ path: sessionPath })
    this.sendProgress(`세션 저장 완료: ${hostname}`)
  }

  // 세션 파일 경로 생성
  private getSessionPath(hostname: string): string {
    // 파일명에 사용 불가한 문자 제거
    const safeName = hostname.replace(/[^a-zA-Z0-9.-]/g, '_')
    return path.join(this.sessionDir, `${safeName}.json`)
  }

  // 저장된 세션 목록 조회
  async getSavedSessions(): Promise<string[]> {
    const files = fs.readdirSync(this.sessionDir)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', '').replace(/_/g, '.'))
  }

  // 세션 삭제
  async deleteSession(hostname: string): Promise<void> {
    const sessionPath = this.getSessionPath(hostname)
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath)
      this.sendProgress(`세션 삭제 완료: ${hostname}`)
    }
  }

  private async extractData(page: Page, url: string, options?: CrawlOptions): Promise<Omit<CrawlResult, 'screenshot'>> {
    const title = await page.title()

    const description = await page.$eval(
      'meta[name="description"]',
      (el) => el.getAttribute('content') || ''
    ).catch(() => '')

    // 기본값: 모두 포함
    const includeAbsolute = options?.includeAbsolutePaths !== false
    const includeRelative = options?.includeRelativePaths !== false

    // 모든 링크 추출 (상대 경로 포함)
    const baseUrl = new URL(url)
    const baseDomain = baseUrl.hostname

    const allLinks = await page.$$eval('a[href]', (elements, baseHref) => {
      return elements
        .map((el) => {
          const href = el.getAttribute('href')
          if (!href) return null

          // 빈 링크, 앵커만 있는 링크 제외
          if (href === '' || href === '#' || href.startsWith('#')) return null

          // javascript:, mailto:, tel: 등 제외
          if (href.startsWith('javascript:') ||
              href.startsWith('mailto:') ||
              href.startsWith('tel:')) return null

          try {
            // 상대 경로를 절대 URL로 변환
            const absoluteUrl = new URL(href, baseHref)
            return absoluteUrl.href
          } catch {
            // URL 변환 실패 시 null
            return null
          }
        })
        .filter((href): href is string => href !== null)
    }, baseUrl.href)

    // 필터링 적용
    const filteredLinks = allLinks.filter((link) => {
      const linkUrl = new URL(link)
      const isInternal = linkUrl.hostname === baseDomain

      // 1. 경로 유형 필터 (절대/상대 경로)
      let passPathFilter = false
      if (isInternal) {
        passPathFilter = includeRelative
      } else {
        passPathFilter = includeAbsolute
      }

      if (!passPathFilter) {
        return false
      }

      // 2. 도메인 필터 (화이트리스트/블랙리스트)
      return this.applyDomainFilter(link, options?.domainSettings)
    })

    return {
      url,
      title,
      description,
      links: [...new Set(filteredLinks)], // 중복 제거
      timestamp: Date.now()
    }
  }

  private async takeScreenshot(page: Page): Promise<string> {
    const buffer = await page.screenshot({ fullPage: false })
    return `data:image/png;base64,${buffer.toString('base64')}`
  }

  private async handleCookieConsent(page: Page): Promise<void> {
    // 일반적인 쿠키 동의 버튼 셀렉터 목록
    const cookieSelectors = [
      // 텍스트 기반 (가장 일반적)
      'button:has-text("Accept")',
      'button:has-text("Accept all")',
      'button:has-text("Accept All")',
      'button:has-text("I agree")',
      'button:has-text("I Agree")',
      'button:has-text("Agree")',
      'button:has-text("OK")',
      'button:has-text("Got it")',
      'button:has-text("Allow")',
      'button:has-text("Allow all")',
      'button:has-text("Consent")',

      // ID/Class 기반
      '#cookie-accept',
      '#accept-cookies',
      '#cookie-consent-accept',
      '.cookie-accept',
      '.accept-cookies',
      '.cookie-consent-button',
      '[id*="cookie"][id*="accept"]',
      '[class*="cookie"][class*="accept"]',

      // ARIA 레이블 기반
      'button[aria-label*="accept" i]',
      'button[aria-label*="cookie" i]',
      'button[aria-label*="consent" i]',

      // 일반 버튼 (cookie/consent 관련)
      'button[class*="cookie"]',
      'button[class*="consent"]',
      'button[id*="cookie"]',
      'button[id*="consent"]',

      // 링크 형태
      'a:has-text("Accept")',
      'a:has-text("I agree")',

      // div 클릭 가능한 요소
      'div[role="button"]:has-text("Accept")',
      'div[role="button"]:has-text("I agree")'
    ]

    // 각 셀렉터를 순차적으로 시도 (짧은 타임아웃)
    for (const selector of cookieSelectors) {
      try {
        const button = await page.$(selector)
        if (button) {
          const isVisible = await button.isVisible()
          if (isVisible) {
            this.sendProgress('쿠키 동의 팝업 처리 중...')
            await button.click({ timeout: 2000 })
            // 클릭 후 팝업이 사라질 때까지 잠시 대기
            await page.waitForTimeout(500)
            this.sendProgress('쿠키 팝업 처리 완료')
            return
          }
        }
      } catch (error) {
        // 셀렉터를 찾지 못하거나 클릭 실패 시 다음 셀렉터 시도
        continue
      }
    }

    // 모든 셀렉터를 시도했지만 팝업을 찾지 못함 (정상 케이스)
  }

  private sendProgress(message: string) {
    this.window.webContents.send('crawler:progress', { message })
  }

  // 패턴 매칭 함수 (와일드카드 지원: *, ?)
  private matchPattern(url: string, pattern: string): boolean {
    // 패턴을 정규식으로 변환
    // * -> .*  (임의의 문자 0개 이상)
    // ? -> .   (임의의 문자 1개)
    // 특수문자 이스케이프
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // 정규식 특수문자 이스케이프
      .replace(/\*/g, '.*')                   // * -> .*
      .replace(/\?/g, '.')                    // ? -> .

    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(url)
  }

  // 도메인 필터 적용
  private applyDomainFilter(link: string, domainSettings?: DomainSettings): boolean {
    if (!domainSettings || Object.keys(domainSettings).length === 0) {
      return true  // 도메인 설정이 없으면 모두 허용
    }

    try {
      const linkUrl = new URL(link)
      const domain = linkUrl.hostname
      const filter = domainSettings[domain]

      if (!filter || filter.patterns.length === 0) {
        return true  // 해당 도메인에 대한 설정이 없으면 허용
      }

      const matchesAnyPattern = filter.patterns.some(pattern =>
        this.matchPattern(link, pattern)
      )

      // 화이트리스트: 패턴 매칭되면 허용
      if (filter.mode === 'whitelist') {
        return matchesAnyPattern
      }
      // 블랙리스트: 패턴 매칭되면 차단
      else {
        return !matchesAnyPattern
      }
    } catch {
      return true  // URL 파싱 실패 시 허용
    }
  }
}
