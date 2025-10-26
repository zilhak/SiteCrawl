import { useState, useEffect } from 'react'
import './style.css'
import type { Pipeline, PipelineTask, ValidationResult, PipelineStats, CrawlTask, ActionTask, AnyTask, TaskPaginationResult } from './types'

interface CrawlResult {
  url: string
  title: string
  description: string
  screenshot: string
  links: string[]
  timestamp: number
}

interface DomainFilter {
  mode: 'whitelist' | 'blacklist'
  patterns: string[]
}

interface DomainSettings {
  [domain: string]: DomainFilter
}

interface CrawlOptions {
  includeAbsolutePaths: boolean
  includeRelativePaths: boolean
  domainSettings: DomainSettings
}

function App() {
  const [url, setUrl] = useState('https://example.com')
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<CrawlResult | null>(null)

  // 옵션 상태
  const [showOptions, setShowOptions] = useState(false)
  const [activeTab, setActiveTab] = useState('path') // 현재 활성 탭
  const [options, setOptions] = useState<CrawlOptions>({
    includeAbsolutePaths: true,
    includeRelativePaths: true,
    domainSettings: {}
  })

  // 도메인 탭 상태
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [newPattern, setNewPattern] = useState('')

  // 저장소 상태
  const [storagePath, setStoragePath] = useState('')
  const [isStorageActive, setIsStorageActive] = useState(false)

  // 모드 상태 (크롤링 vs 파이프라인 설정)
  const [mode, setMode] = useState<'crawling' | 'pipeline-config'>('crawling')

  // 파이프라인 검색 상태
  const [pipelineSearch, setPipelineSearch] = useState('')
  const [showPipelineSuggestions, setShowPipelineSuggestions] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)

  // 파이프라인 설정 탭
  const [pipelineConfigTab, setPipelineConfigTab] = useState('url-extract') // 'url-extract' | 'work-task' | 'pipeline'

  // 파이프라인 목록
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [filteredPipelines, setFilteredPipelines] = useState<Pipeline[]>([])

  // Task 목록 (URL추출 태스크)
  const [crawlTasks, setCrawlTasks] = useState<CrawlTask[]>([])
  const [crawlTasksTotal, setCrawlTasksTotal] = useState(0)
  const [crawlTasksPage, setCrawlTasksPage] = useState(1)
  const [crawlTasksTotalPages, setCrawlTasksTotalPages] = useState(0)
  const [selectedCrawlTasks, setSelectedCrawlTasks] = useState<Set<string>>(new Set())

  // Task 목록 (작업 태스크)
  const [actionTasks, setActionTasks] = useState<ActionTask[]>([])
  const [actionTasksTotal, setActionTasksTotal] = useState(0)
  const [actionTasksPage, setActionTasksPage] = useState(1)
  const [actionTasksTotalPages, setActionTasksTotalPages] = useState(0)
  const [selectedActionTasks, setSelectedActionTasks] = useState<Set<string>>(new Set())

  // 도메인 추가
  const addDomain = () => {
    if (!newDomain.trim()) return
    const domain = newDomain.trim()
    if (options.domainSettings[domain]) {
      alert('이미 존재하는 도메인입니다')
      return
    }
    setOptions({
      ...options,
      domainSettings: {
        ...options.domainSettings,
        [domain]: { mode: 'blacklist', patterns: [] }
      }
    })
    setSelectedDomain(domain)
    setNewDomain('')
  }

  // 도메인 삭제
  const deleteDomain = (domain: string) => {
    const newSettings = { ...options.domainSettings }
    delete newSettings[domain]
    setOptions({ ...options, domainSettings: newSettings })
    if (selectedDomain === domain) {
      setSelectedDomain(null)
    }
  }

  // 필터 모드 변경
  const updateFilterMode = (mode: 'whitelist' | 'blacklist') => {
    if (!selectedDomain) return
    setOptions({
      ...options,
      domainSettings: {
        ...options.domainSettings,
        [selectedDomain]: {
          ...options.domainSettings[selectedDomain],
          mode
        }
      }
    })
  }

  // 패턴 추가
  const addPattern = () => {
    if (!selectedDomain || !newPattern.trim()) return
    const pattern = newPattern.trim()
    const currentPatterns = options.domainSettings[selectedDomain].patterns
    if (currentPatterns.includes(pattern)) {
      alert('이미 존재하는 패턴입니다')
      return
    }
    setOptions({
      ...options,
      domainSettings: {
        ...options.domainSettings,
        [selectedDomain]: {
          ...options.domainSettings[selectedDomain],
          patterns: [...currentPatterns, pattern]
        }
      }
    })
    setNewPattern('')
  }

  // 패턴 삭제
  const deletePattern = (pattern: string) => {
    if (!selectedDomain) return
    setOptions({
      ...options,
      domainSettings: {
        ...options.domainSettings,
        [selectedDomain]: {
          ...options.domainSettings[selectedDomain],
          patterns: options.domainSettings[selectedDomain].patterns.filter(p => p !== pattern)
        }
      }
    })
  }

  // 저장 경로 선택
  const selectStoragePath = async () => {
    const path = await window.storage.selectPath()
    if (path) {
      setStoragePath(path)
      setIsStorageActive(true)
    }
  }

  // 저장소 상태 확인
  const checkStorageStatus = async () => {
    const active = await window.storage.isActive()
    setIsStorageActive(active)
  }

  const startCrawl = async () => {
    if (!url || isLoading) return
    if (!options.includeAbsolutePaths && !options.includeRelativePaths) {
      setError('최소 하나의 경로 유형을 선택해야 합니다')
      return
    }

    setIsLoading(true)
    setProgress('크롤링 시작...')
    setError('')
    setResult(null)

    try {
      await window.crawler.startCrawl(url, false, options)
    } catch (err) {
      console.error('Crawl error:', err)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      startCrawl()
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR')
  }

  // 파이프라인 로드
  const loadPipelines = async () => {
    try {
      const allPipelines = await window.pipeline.getAll()
      setPipelines(allPipelines)
    } catch (err) {
      console.error('파이프라인 로드 실패:', err)
    }
  }

  // 파이프라인 검색 필터링
  useEffect(() => {
    if (!pipelineSearch.trim()) {
      setFilteredPipelines([])
      return
    }
    const query = pipelineSearch.toLowerCase()
    const filtered = pipelines.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    )
    setFilteredPipelines(filtered)
  }, [pipelineSearch, pipelines])

  // 파이프라인 선택
  const selectPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline)
    setPipelineSearch('')
    setShowPipelineSuggestions(false)
  }

  // 파이프라인 선택 해제
  const clearPipeline = () => {
    setSelectedPipeline(null)
  }

  // 파이프라인 생성
  const createNewPipeline = async () => {
    const name = prompt('새 파이프라인 이름을 입력하세요:')
    if (!name || !name.trim()) return

    const description = prompt('설명을 입력하세요 (선택사항):')

    try {
      const newPipeline = await window.pipeline.create(name.trim(), description || undefined)
      await loadPipelines()
      alert(`파이프라인 "${name}"이 생성되었습니다.`)
    } catch (err: any) {
      alert(`파이프라인 생성 실패: ${err.message}`)
    }
  }

  // 파이프라인 삭제
  const deletePipelineById = async (id: string, name: string) => {
    if (!confirm(`"${name}" 파이프라인을 삭제하시겠습니까?`)) return

    try {
      const success = await window.pipeline.delete(id)
      if (success) {
        await loadPipelines()
        alert('파이프라인이 삭제되었습니다.')
      } else {
        alert('파이프라인 삭제에 실패했습니다.')
      }
    } catch (err: any) {
      alert(`파이프라인 삭제 실패: ${err.message}`)
    }
  }

  // CrawlTask 로드
  const loadCrawlTasks = async (page: number = 1) => {
    try {
      const result = await window.task.getPaginated('crawl', page, 20)
      setCrawlTasks(result.tasks as CrawlTask[])
      setCrawlTasksTotal(result.total)
      setCrawlTasksPage(result.page)
      setCrawlTasksTotalPages(result.totalPages)
    } catch (err) {
      console.error('CrawlTask 로드 실패:', err)
    }
  }

  // ActionTask 로드
  const loadActionTasks = async (page: number = 1) => {
    try {
      const result = await window.task.getPaginated('action', page, 20)
      setActionTasks(result.tasks as ActionTask[])
      setActionTasksTotal(result.total)
      setActionTasksPage(result.page)
      setActionTasksTotalPages(result.totalPages)
    } catch (err) {
      console.error('ActionTask 로드 실패:', err)
    }
  }

  // CrawlTask 빠른 추가
  const addQuickCrawlTask = async () => {
    try {
      await window.task.createQuickCrawl()
      await loadCrawlTasks(crawlTasksPage)
    } catch (err: any) {
      alert(`Task 생성 실패: ${err.message}`)
    }
  }

  // ActionTask 빠른 추가
  const addQuickActionTask = async () => {
    try {
      await window.task.createQuickAction()
      await loadActionTasks(actionTasksPage)
    } catch (err: any) {
      alert(`Task 생성 실패: ${err.message}`)
    }
  }

  // CrawlTask 체크박스 토글
  const toggleCrawlTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedCrawlTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedCrawlTasks(newSelected)
  }

  // ActionTask 체크박스 토글
  const toggleActionTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedActionTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedActionTasks(newSelected)
  }

  // CrawlTask 선택된 항목 삭제
  const deleteSelectedCrawlTasks = async () => {
    if (selectedCrawlTasks.size === 0) {
      alert('삭제할 항목을 선택해주세요.')
      return
    }

    if (!confirm(`${selectedCrawlTasks.size}개의 Task를 삭제하시겠습니까?`)) return

    try {
      const ids = Array.from(selectedCrawlTasks)
      const deleted = await window.task.deleteMultiple(ids)
      alert(`${deleted}개의 Task가 삭제되었습니다.`)
      setSelectedCrawlTasks(new Set())
      await loadCrawlTasks(crawlTasksPage)
    } catch (err: any) {
      alert(`Task 삭제 실패: ${err.message}`)
    }
  }

  // ActionTask 선택된 항목 삭제
  const deleteSelectedActionTasks = async () => {
    if (selectedActionTasks.size === 0) {
      alert('삭제할 항목을 선택해주세요.')
      return
    }

    if (!confirm(`${selectedActionTasks.size}개의 Task를 삭제하시겠습니까?`)) return

    try {
      const ids = Array.from(selectedActionTasks)
      const deleted = await window.task.deleteMultiple(ids)
      alert(`${deleted}개의 Task가 삭제되었습니다.`)
      setSelectedActionTasks(new Set())
      await loadActionTasks(actionTasksPage)
    } catch (err: any) {
      alert(`Task 삭제 실패: ${err.message}`)
    }
  }

  useEffect(() => {
    // 진행 상태 리스너
    window.crawler.onProgress((data: any) => {
      setProgress(data.message)
    })

    // 완료 리스너
    window.crawler.onComplete((data: CrawlResult) => {
      setIsLoading(false)
      setProgress('')
      setResult(data)
    })

    // 에러 리스너
    window.crawler.onError((errorMsg: string) => {
      setIsLoading(false)
      setProgress('')
      setError(errorMsg)
    })

    // 저장소 상태 확인
    checkStorageStatus()

    // 파이프라인 로드
    loadPipelines()

    // Task 로드
    loadCrawlTasks(1)
    loadActionTasks(1)
  }, [])

  // 파이프라인 설정 탭 변경 시 Task 로드
  useEffect(() => {
    if (mode === 'pipeline-config') {
      if (pipelineConfigTab === 'url-extract') {
        loadCrawlTasks(1)
      } else if (pipelineConfigTab === 'work-task') {
        loadActionTasks(1)
      }
    }
  }, [pipelineConfigTab, mode])

  return (
    <div id="app">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-text">
              <h1>SiteCrawl</h1>
            </div>
            <div className="header-buttons">
              <button
                className="mode-toggle-btn"
                onClick={() => setMode(mode === 'crawling' ? 'pipeline-config' : 'crawling')}
                title={mode === 'crawling' ? '파이프라인 설정' : '크롤링 화면'}
              >
                {mode === 'crawling' ? '🔧 파이프라인 설정' : '🕷️ 크롤링'}
              </button>
              <button
                className="options-btn"
                onClick={() => setShowOptions(true)}
                title="크롤링 옵션"
              >
                ⚙️ 옵션
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 옵션 모달 */}
      {showOptions && (
        <div className="modal-overlay" onClick={() => setShowOptions(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>크롤링 옵션</h2>
              <button className="modal-close" onClick={() => setShowOptions(false)}>
                ✕
              </button>
            </div>

            {/* 탭 메뉴 */}
            <div className="tab-menu">
              <button
                className={`tab-item ${activeTab === 'general' ? 'active' : ''}`}
                onClick={() => setActiveTab('general')}
              >
                ⚙️ 일반
              </button>
              <button
                className={`tab-item ${activeTab === 'path' ? 'active' : ''}`}
                onClick={() => setActiveTab('path')}
              >
                📁 경로
              </button>
              <button
                className={`tab-item ${activeTab === 'domain' ? 'active' : ''}`}
                onClick={() => setActiveTab('domain')}
              >
                🌐 도메인
              </button>
            </div>

            <div className="modal-body">
              {/* 일반 탭 */}
              {activeTab === 'general' && (
                <div className="tab-content">
                  <div className="option-section">
                    <h3>저장 데이터 경로</h3>
                    <p className="option-description">프로그램 데이터를 저장할 경로를 설정하세요</p>

                    <div className="storage-path-section">
                      <div className="path-display">
                        <input
                          type="text"
                          className="path-input"
                          value={storagePath}
                          readOnly
                          placeholder="경로가 설정되지 않음"
                        />
                        <button className="btn-select-path" onClick={selectStoragePath}>
                          📁 경로 선택
                        </button>
                      </div>

                      {storagePath && (
                        <div className="storage-status active">
                          ✅ 저장소가 활성화되었습니다
                        </div>
                      )}

                      {!storagePath && (
                        <div className="storage-status inactive">
                          ⚠️ 경로를 설정하지 않으면 데이터가 저장되지 않습니다
                        </div>
                      )}
                    </div>

                    <div className="info-box">
                      <strong>ℹ️ 저장 정보</strong>
                      <ul>
                        <li>크롤링 히스토리, Task, Pipeline 등의 데이터가 저장됩니다</li>
                        <li>저장된 데이터는 SQLite 데이터베이스로 관리됩니다</li>
                        <li>경로를 설정하지 않아도 크롤링 기능은 정상 작동합니다</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* 도메인 탭 */}
              {activeTab === 'domain' && (
                <div className="tab-content domain-tab">
                  <div className="domain-layout">
                    {/* 좌측: 도메인 목록 */}
                    <div className="domain-list-panel">
                      <div className="domain-list-header">
                        <h3>도메인 목록</h3>
                        <div className="domain-add-group">
                          <input
                            type="text"
                            className="domain-input"
                            placeholder="예: example.com"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addDomain()}
                          />
                          <button className="btn-add" onClick={addDomain}>
                            ➕
                          </button>
                        </div>
                      </div>

                      <div className="domain-list">
                        {Object.keys(options.domainSettings).length === 0 ? (
                          <div className="empty-domains">
                            <p>설정된 도메인이 없습니다</p>
                            <small>도메인을 추가하여 필터링 규칙을 설정하세요</small>
                          </div>
                        ) : (
                          Object.keys(options.domainSettings).map((domain) => (
                            <div
                              key={domain}
                              className={`domain-item ${selectedDomain === domain ? 'selected' : ''}`}
                              onClick={() => setSelectedDomain(domain)}
                            >
                              <div className="domain-info">
                                <div className="domain-name">{domain}</div>
                                <div className="domain-meta">
                                  <span className={`mode-badge ${options.domainSettings[domain].mode}`}>
                                    {options.domainSettings[domain].mode === 'whitelist' ? '화이트리스트' : '블랙리스트'}
                                  </span>
                                  <span className="pattern-count">
                                    {options.domainSettings[domain].patterns.length}개 패턴
                                  </span>
                                </div>
                              </div>
                              <button
                                className="btn-delete-domain"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteDomain(domain)
                                }}
                                title="도메인 삭제"
                              >
                                🗑️
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 우측: 설정 패널 */}
                    <div className="domain-settings-panel">
                      {selectedDomain ? (
                        <>
                          <h3>🌐 {selectedDomain} 설정</h3>

                          {/* 필터 모드 선택 */}
                          <div className="option-section">
                            <h4>필터 모드</h4>
                            <div className="radio-group">
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="filterMode"
                                  checked={options.domainSettings[selectedDomain].mode === 'blacklist'}
                                  onChange={() => updateFilterMode('blacklist')}
                                />
                                <span className="radio-text">
                                  <strong>🚫 블랙리스트</strong>
                                  <small>패턴에 해당하는 링크를 제외합니다</small>
                                </span>
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="filterMode"
                                  checked={options.domainSettings[selectedDomain].mode === 'whitelist'}
                                  onChange={() => updateFilterMode('whitelist')}
                                />
                                <span className="radio-text">
                                  <strong>✅ 화이트리스트</strong>
                                  <small>패턴에 해당하는 링크만 포함합니다</small>
                                </span>
                              </label>
                            </div>
                          </div>

                          {/* 패턴 목록 */}
                          <div className="option-section">
                            <h4>URL 패턴</h4>
                            <p className="option-description">
                              와일드카드(*) 사용 가능: */products/*, */blog/*
                            </p>

                            <div className="pattern-add-group">
                              <input
                                type="text"
                                className="pattern-input"
                                placeholder="예: */products/*, */category/*"
                                value={newPattern}
                                onChange={(e) => setNewPattern(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addPattern()}
                              />
                              <button className="btn-add-pattern" onClick={addPattern}>
                                추가
                              </button>
                            </div>

                            <div className="pattern-list">
                              {options.domainSettings[selectedDomain].patterns.length === 0 ? (
                                <div className="empty-patterns">
                                  패턴이 없습니다. 패턴을 추가하세요.
                                </div>
                              ) : (
                                options.domainSettings[selectedDomain].patterns.map((pattern, idx) => (
                                  <div key={idx} className="pattern-item">
                                    <code>{pattern}</code>
                                    <button
                                      className="btn-delete-pattern"
                                      onClick={() => deletePattern(pattern)}
                                      title="패턴 삭제"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="info-box">
                            <strong>💡 사용 예시:</strong>
                            <ul>
                              <li><code>*/products/*</code> - products 경로가 포함된 모든 URL</li>
                              <li><code>*/blog/2024/*</code> - 2024년 블로그 포스트</li>
                              <li><code>*.pdf</code> - PDF 파일 링크</li>
                              <li><code>*/category/tech*</code> - tech로 시작하는 카테고리</li>
                            </ul>
                          </div>
                        </>
                      ) : (
                        <div className="empty-selection">
                          <p>좌측에서 도메인을 선택하세요</p>
                          <small>도메인별로 링크 필터링 규칙을 설정할 수 있습니다</small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 경로 탭 */}
              {activeTab === 'path' && (
                <div className="tab-content">
                  <div className="option-section">
                    <h3>링크 추출 설정</h3>
                    <p className="option-description">추출할 링크의 경로 유형을 선택하세요</p>

                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={options.includeAbsolutePaths}
                          onChange={(e) => setOptions({
                            ...options,
                            includeAbsolutePaths: e.target.checked
                          })}
                        />
                        <span className="checkbox-text">
                          <strong>절대 경로 포함</strong>
                          <small>다른 도메인으로 이동하는 링크 (외부 링크)</small>
                          <code>예: https://google.com, https://github.com</code>
                        </span>
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={options.includeRelativePaths}
                          onChange={(e) => setOptions({
                            ...options,
                            includeRelativePaths: e.target.checked
                          })}
                        />
                        <span className="checkbox-text">
                          <strong>상대 경로 포함</strong>
                          <small>같은 도메인 내부의 링크 (내부 링크)</small>
                          <code>예: /about, /contact, ./page.html</code>
                        </span>
                      </label>
                    </div>

                    {!options.includeAbsolutePaths && !options.includeRelativePaths && (
                      <div className="warning-message">
                        ⚠️ 최소 하나의 경로 유형을 선택해야 합니다
                      </div>
                    )}

                    <div className="info-box">
                      <strong>💡 팁:</strong>
                      <ul>
                        <li><strong>절대 경로만</strong>: 외부 링크만 수집 (SEO 분석, 백링크 확인)</li>
                        <li><strong>상대 경로만</strong>: 내부 페이지만 수집 (사이트맵 생성)</li>
                        <li><strong>둘 다 선택</strong>: 모든 링크 수집 (전체 링크 분석)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowOptions(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="main">
        <div className="container">
          {/* 크롤링 모드 */}
          {mode === 'crawling' && (
            <>
              {/* 파이프라인 검색 및 선택 */}
              {/* 파이프라인 검색 및 선택 */}
              {selectedPipeline ? (
                <div className="selected-pipeline">
                  <div className="selected-pipeline-info">
                    <div className="selected-pipeline-name">{selectedPipeline.name}</div>
                    <div className="selected-pipeline-desc">{selectedPipeline.description || '설명 없음'}</div>
                  </div>
                  <button className="btn-clear-pipeline" onClick={clearPipeline}>✕</button>
                </div>
              ) : (
                <div className="pipeline-selector">
                  <input
                    type="text"
                    className="pipeline-search-input"
                    placeholder="파이프라인 검색 (선택사항)"
                    value={pipelineSearch}
                    onChange={(e) => setPipelineSearch(e.target.value)}
                    onFocus={() => setShowPipelineSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowPipelineSuggestions(false), 200)}
                  />
                  {showPipelineSuggestions && pipelineSearch && (
                    <div className="pipeline-suggestions">
                      {filteredPipelines.length > 0 ? (
                        filteredPipelines.map(pipeline => (
                          <div
                            key={pipeline.id}
                            className="suggestion-item"
                            onClick={() => selectPipeline(pipeline)}
                          >
                            <div className="suggestion-name">{pipeline.name}</div>
                            <div className="suggestion-desc">{pipeline.description || '설명 없음'}</div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-patterns" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                          파이프라인을 찾을 수 없습니다
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 컨트롤 패널 */}
              <div className="control-panel">
            <div className="url-input-group">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="text"
                className="url-input"
                placeholder="크롤링할 URL을 입력하세요 (예: https://example.com)"
                onKeyUp={handleKeyPress}
                disabled={isLoading}
              />
              <button
                className="crawl-btn"
                onClick={startCrawl}
                disabled={isLoading || !url}
              >
                {isLoading ? '크롤링 중...' : '크롤링 시작'}
              </button>
            </div>

            {/* 진행 상태 */}
            {progress && (
              <div className="progress">
                {progress}
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="error">
                ❌ {error}
              </div>
            )}

            {/* 저장소 경고 메시지 */}
            {!isStorageActive && (
              <div className="storage-warning">
                ⚠️ 저장 데이터 경로를 설정하지 않으면 데이터 저장 기능이 비활성화됩니다
              </div>
            )}
          </div>

          {/* 결과 표시 */}
          {result ? (
            <div className="results">
              <h2>📊 크롤링 결과</h2>

              <div className="result-section">
                <h3>URL</h3>
                <div className="result-value">{result.url}</div>
              </div>

              <div className="result-section">
                <h3>제목</h3>
                <div className="result-value">{result.title}</div>
              </div>

              {result.description && (
                <div className="result-section">
                  <h3>설명</h3>
                  <div className="result-value">{result.description}</div>
                </div>
              )}

              <div className="result-section">
                <h3>스크린샷</h3>
                <img src={result.screenshot} alt="Screenshot" className="screenshot" />
              </div>

              <div className="result-section">
                <h3>링크 ({result.links.length}개)</h3>
                <div className="links-list">
                  {result.links.map((link, index) => (
                    <a
                      key={index}
                      href={link}
                      className="link-item"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>

              <div className="result-section">
                <h3>크롤링 시간</h3>
                <div className="result-value">{formatTimestamp(result.timestamp)}</div>
              </div>
            </div>
          ) : !isLoading ? (
            <div className="results">
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>URL을 입력하고 크롤링을 시작하세요</p>
              </div>
            </div>
          ) : null}
            </>
          )}

          {/* 파이프라인 설정 모드 */}
          {mode === 'pipeline-config' && (
            <div className="pipeline-config">
              {/* 탭 메뉴 */}
              <div className="pipeline-tabs">
                <button
                  className={`pipeline-tab ${pipelineConfigTab === 'url-extract' ? 'active' : ''}`}
                  onClick={() => setPipelineConfigTab('url-extract')}
                >
                  🔗 URL추출 태스크
                </button>
                <button
                  className={`pipeline-tab ${pipelineConfigTab === 'work-task' ? 'active' : ''}`}
                  onClick={() => setPipelineConfigTab('work-task')}
                >
                  ⚙️ 작업 태스크
                </button>
                <button
                  className={`pipeline-tab ${pipelineConfigTab === 'pipeline' ? 'active' : ''}`}
                  onClick={() => setPipelineConfigTab('pipeline')}
                >
                  🔧 파이프라인
                </button>
              </div>

              {/* 탭 컨텐츠 */}
              <div className="pipeline-tab-content">
                {pipelineConfigTab === 'url-extract' && (
                  <div className="tab-panel">
                    {/* 툴바 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h2 style={{ marginBottom: '4px' }}>URL추출 태스크</h2>
                        <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
                          URL을 필터링하여 다음 작업으로 전달하는 태스크를 관리합니다.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          style={{ padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                          onClick={addQuickCrawlTask}
                        >
                          + 추가
                        </button>
                        <button
                          style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', opacity: selectedCrawlTasks.size === 0 ? 0.5 : 1 }}
                          onClick={deleteSelectedCrawlTasks}
                          disabled={selectedCrawlTasks.size === 0}
                        >
                          삭제 ({selectedCrawlTasks.size})
                        </button>
                        <button
                          style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', opacity: selectedCrawlTasks.size === 0 ? 0.5 : 1 }}
                          onClick={() => alert('편집 기능은 개발 중입니다.')}
                          disabled={selectedCrawlTasks.size === 0}
                        >
                          편집
                        </button>
                      </div>
                    </div>

                    {!isStorageActive ? (
                      <div className="storage-warning">
                        ⚠️ 저장소가 설정되지 않았습니다. 옵션에서 저장 경로를 설정해주세요.
                      </div>
                    ) : crawlTasks.length === 0 ? (
                      <div className="empty-tab-state">
                        <h3>등록된 URL추출 태스크가 없습니다</h3>
                        <p>+ 추가 버튼을 눌러 새 태스크를 생성하세요.</p>
                      </div>
                    ) : (
                      <>
                        {/* 테이블 */}
                        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f9f9f9', borderBottom: '2px solid #e0e0e0' }}>
                              <tr>
                                <th style={{ padding: '12px', width: '40px', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={crawlTasks.length > 0 && selectedCrawlTasks.size === crawlTasks.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCrawlTasks(new Set(crawlTasks.map(t => t.id)))
                                      } else {
                                        setSelectedCrawlTasks(new Set())
                                      }
                                    }}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                </th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '13px' }}>이름</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '13px' }}>타입</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '13px' }}>패턴 개수</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '13px' }}>Limit</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '13px' }}>생성일</th>
                              </tr>
                            </thead>
                            <tbody>
                              {crawlTasks.map((task, index) => (
                                <tr
                                  key={task.id}
                                  style={{
                                    borderBottom: index < crawlTasks.length - 1 ? '1px solid #f0f0f0' : 'none',
                                    background: selectedCrawlTasks.has(task.id) ? '#f8f9ff' : 'white'
                                  }}
                                >
                                  <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedCrawlTasks.has(task.id)}
                                      onChange={() => toggleCrawlTaskSelection(task.id)}
                                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                  </td>
                                  <td style={{ padding: '12px', fontSize: '13px', fontWeight: 500 }}>{task.name}</td>
                                  <td style={{ padding: '12px', fontSize: '13px' }}>
                                    <span style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      background: task.config.type === 'whitelist' ? '#e8f5e9' : '#ffebee',
                                      color: task.config.type === 'whitelist' ? '#2e7d32' : '#c62828'
                                    }}>
                                      {task.config.type}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>{task.config.patterns.length}개</td>
                                  <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>{task.config.limit === -1 ? '무제한' : task.config.limit}</td>
                                  <td style={{ padding: '12px', fontSize: '12px', color: '#999' }}>{formatTimestamp(task.createdAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* 페이지네이션 */}
                        {crawlTasksTotalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                            <button
                              style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '13px' }}
                              onClick={() => loadCrawlTasks(crawlTasksPage - 1)}
                              disabled={crawlTasksPage === 1}
                            >
                              이전
                            </button>
                            <span style={{ fontSize: '13px', color: '#666' }}>
                              {crawlTasksPage} / {crawlTasksTotalPages} ({crawlTasksTotal}개)
                            </span>
                            <button
                              style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '13px' }}
                              onClick={() => loadCrawlTasks(crawlTasksPage + 1)}
                              disabled={crawlTasksPage === crawlTasksTotalPages}
                            >
                              다음
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {pipelineConfigTab === 'work-task' && (
                  <div className="tab-panel">
                    <h2>작업 태스크</h2>
                    <p className="tab-description">
                      URL을 입력받아 데이터를 수집하거나 작업을 수행하는 태스크를 관리합니다.
                    </p>
                    <div className="task-list">
                      <div className="empty-state">
                        <p>등록된 작업 태스크가 없습니다</p>
                        <button className="btn-primary">+ 새 태스크 추가</button>
                      </div>
                    </div>
                  </div>
                )}

                {pipelineConfigTab === 'pipeline' && (
                  <div className="tab-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h2 style={{ marginBottom: '8px' }}>파이프라인</h2>
                        <p className="tab-description" style={{ margin: 0 }}>
                          태스크들을 연결하여 자동화 워크플로우를 구성합니다.
                        </p>
                      </div>
                      <button className="btn-add-task" onClick={createNewPipeline}>+ 새 파이프라인 추가</button>
                    </div>

                    {!isStorageActive ? (
                      <div className="storage-warning">
                        ⚠️ 저장소가 설정되지 않았습니다. 옵션에서 저장 경로를 설정해주세요.
                      </div>
                    ) : pipelines.length === 0 ? (
                      <div className="empty-tab-state">
                        <h3>등록된 파이프라인이 없습니다</h3>
                        <p>새 파이프라인을 추가하여 크롤링 워크플로우를 자동화하세요.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pipelines.map(pipeline => (
                          <div
                            key={pipeline.id}
                            style={{
                              padding: '16px',
                              background: '#f9f9f9',
                              borderRadius: '8px',
                              border: '1px solid #e0e0e0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
                                {pipeline.name}
                              </h3>
                              {pipeline.description && (
                                <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                                  {pipeline.description}
                                </p>
                              )}
                              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#999' }}>
                                <span>태스크: {pipeline.tasks.length}개</span>
                                <span>생성: {formatTimestamp(pipeline.createdAt)}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                style={{
                                  padding: '8px 16px',
                                  background: '#667eea',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                  // TODO: 파이프라인 편집 모달
                                  alert('파이프라인 편집 기능은 개발 중입니다.')
                                }}
                              >
                                편집
                              </button>
                              <button
                                style={{
                                  padding: '8px 16px',
                                  background: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => deletePipelineById(pipeline.id, pipeline.name)}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
