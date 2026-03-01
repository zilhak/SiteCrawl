/**
 * Filter 시스템 타입 정의
 */

export interface Filter {
  id: string
  name: string
  description?: string
  mode: 'whitelist' | 'blacklist'
  regex?: string        // 정규표현식 (단일)
  wildcards?: string[]  // 와일드카드 패턴 배열
  createdAt: number
  updatedAt: number
}

export interface CreateFilterDTO {
  name: string
  description?: string
  mode: 'whitelist' | 'blacklist'
  regex?: string
  wildcards?: string[]
}

export interface FilterValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
