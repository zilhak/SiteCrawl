/**
 * Task 시스템 타입 정의
 */

// 기본 Task 인터페이스
export interface Task {
  id: string
  name: string
  description?: string
  category: 'crawl' | 'action'
  createdAt: number
  updatedAt: number
}

// CrawlTask - URL 추출/필터링
export interface CrawlTask extends Task {
  category: 'crawl'
  config: {
    type: 'blacklist' | 'whitelist'
    patterns: string[]  // regex 패턴
    limit: number       // -1이면 무제한
    includeAbsolutePaths: boolean  // 절대경로 포함 여부
    includeRelativePaths: boolean  // 상대경로 포함 여부
  }
}

// ActionTask - 실제 작업 수행
export interface ActionTask extends Task {
  category: 'action'
  config: {
    action: string      // 액션 종류 (미정)
    resultName: string  // 결과 저장 폴더명 (상대경로)
  }
}

// Task 유니온 타입
export type AnyTask = CrawlTask | ActionTask

// Task 생성 DTO
export interface CreateCrawlTaskDTO {
  name: string
  description?: string
  type: 'blacklist' | 'whitelist'
  includeAbsolutePaths?: boolean
  includeRelativePaths?: boolean
  patterns: string[]
  limit: number
}

export interface CreateActionTaskDTO {
  name: string
  description?: string
  action: string
  resultName: string
}

// Task 검증 결과
export interface TaskValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
