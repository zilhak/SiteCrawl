import { useState, useEffect } from 'react'
import './style.css'

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
  }, [])

  return (
    <div id="app">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-text">
              <h1>🕷️ Web Crawler</h1>
              <p>Playwright 기반 웹사이트 크롤러</p>
            </div>
            <button
              className="options-btn"
              onClick={() => setShowOptions(true)}
              title="크롤링 옵션"
            >
              ⚙️ 옵션
            </button>
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
              {/* 나중에 추가될 탭들
              <button
                className={`tab-item ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => setActiveTab('login')}
              >
                🔐 로그인
              </button>
              <button
                className={`tab-item ${activeTab === 'screenshot' ? 'active' : ''}`}
                onClick={() => setActiveTab('screenshot')}
              >
                📸 스크린샷
              </button>
              */}
            </div>

            <div className="modal-body">
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
        </div>
      </main>
    </div>
  )
}

export default App
