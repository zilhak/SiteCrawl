/**
 * Task 시스템 타입 정의
 * 컨셉 문서 기준 4종 Task
 */

// Task 카테고리
export type TaskCategory = 'string_filter' | 'page_navigation' | 'link_extraction' | 'resource_extraction' | 'string_db_save' | 'string_display' | 'result_save' | 'page_db_check' | 'page_db_save'

// 기본 Task 인터페이스
export interface Task {
  id: string
  name: string
  description?: string
  category: TaskCategory
  createdAt: number
  updatedAt: number
}

// 1. 문자열 필터링 태스크: string[] → string[]
// 내부 동작: URL[] → 사전필터 → 이동 → URL추출 → 사후필터 → URL[]
export interface StringFilterTask extends Task {
  category: 'string_filter'
  config: StringFilterConfig
}

export interface StringFilterConfig {
  preFilterId?: string   // 사전 필터 (Filter 엔티티 ID 참조)
  postFilterId?: string  // 사후 필터 (Filter 엔티티 ID 참조)
  limit: number          // -1이면 무제한
}

// 2. 페이지 이동 태스크: string → Page
export interface PageNavigationTask extends Task {
  category: 'page_navigation'
  config: PageNavigationConfig
}

export interface PageNavigationConfig {
  waitUntil: 'domcontentloaded' | 'load' | 'networkidle'
  timeout: number        // ms
  handleCookies: boolean
}

// 3. 링크 추출 태스크: Page → string[]
export interface LinkExtractionTask extends Task {
  category: 'link_extraction'
  config: LinkExtractionConfig
}

export interface LinkExtractionConfig {
  includeHrefLinks: boolean       // a[href] 링크 추출
  includeTextUrls: boolean        // 본문 텍스트 내 URL 추출
  includeAbsolutePaths: boolean   // 절대경로 포함
  includeRelativePaths: boolean   // 상대경로 포함
  postFilterId?: string           // 추출 후 필터 (선택)
}

// 4. 리소스 추출 태스크: string[] → string[]
export interface ResourceExtractionTask extends Task {
  category: 'resource_extraction'
  config: ResourceExtractionConfig
}

export interface ResourceExtractionConfig {
  resourceTypes: ResourceType[]
  filterId?: string               // Filter 엔티티 ID 참조
}

export type ResourceType = 'image' | 'pdf' | 'video' | 'css' | 'js'

// 5. 문자열 DB 저장 태스크: string[] → string[] (pass-through)
export interface StringDbSaveTask extends Task {
  category: 'string_db_save'
  config: StringDbSaveConfig
}

export interface StringDbSaveConfig {
  deduplication: boolean  // 같은 pipeline에서 이미 저장된 문자열 중복 방지
  resultIndex?: number | 'all'  // Result에서 읽기 (Final 구간용)
}

// 6. 문자열 화면 표시 태스크: string[] → string[] (pass-through)
export interface StringDisplayTask extends Task {
  category: 'string_display'
  config: StringDisplayConfig
}

export interface StringDisplayConfig {
  label?: string  // 표시 영역 제목 (미지정 시 태스크 이름 사용)
  resultIndex?: number | 'all'  // Result에서 읽기 (Final 구간용)
}

// 7. Result 저장 태스크: string[] → 없음 (터미널)
export interface ResultSaveTask extends Task {
  category: 'result_save'
  config: ResultSaveConfig
}

export interface ResultSaveConfig {
  targetIndex: number  // -1이면 append, 0 이상이면 해당 인덱스에 저장
}

// 8. 페이지 방문 체크 태스크: Page → Page (조건부 게이트)
export interface PageDbCheckTask extends Task {
  category: 'page_db_check'
  config: PageDbCheckConfig
}

export interface PageDbCheckConfig {
  passCondition: 'exists' | 'not_exists'  // 저장되었으면 통과 / 저장되지 않았으면 통과
}

// 9. 페이지 방문 저장 태스크: Page → Page (pass-through)
export interface PageDbSaveTask extends Task {
  category: 'page_db_save'
  config: PageDbSaveConfig
}

export interface PageDbSaveConfig {
  // 도메인별 자동 테이블 생성, URL pathname 저장
}

// Task 유니온 타입
export type AnyTask = StringFilterTask | PageNavigationTask | LinkExtractionTask | ResourceExtractionTask | StringDbSaveTask | StringDisplayTask | ResultSaveTask | PageDbCheckTask | PageDbSaveTask

// Task Config 유니온 타입
export type AnyTaskConfig = StringFilterConfig | PageNavigationConfig | LinkExtractionConfig | ResourceExtractionConfig | StringDbSaveConfig | StringDisplayConfig | ResultSaveConfig | PageDbCheckConfig | PageDbSaveConfig

// Task 생성 DTO
export interface CreateTaskDTO {
  name: string
  description?: string
  category: TaskCategory
  config: AnyTaskConfig
}

// Task 검증 결과
export interface TaskValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
