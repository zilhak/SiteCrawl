/**
 * Task 시스템 타입 정의
 * 컨셉 문서 기준 4종 Task
 */

// Task 카테고리
export type TaskCategory = 'string_filter' | 'page_navigation' | 'link_extraction' | 'resource_extraction'

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

// Task 유니온 타입
export type AnyTask = StringFilterTask | PageNavigationTask | LinkExtractionTask | ResourceExtractionTask

// Task Config 유니온 타입
export type AnyTaskConfig = StringFilterConfig | PageNavigationConfig | LinkExtractionConfig | ResourceExtractionConfig

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
