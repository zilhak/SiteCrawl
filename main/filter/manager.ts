/**
 * Filter 관리자
 */

import { randomUUID } from 'crypto'
import type {
  Filter,
  CreateFilterDTO,
  FilterValidationResult
} from './types'
import { FilterDatabase } from './database'

export class FilterManager {
  private filterDB: FilterDatabase

  constructor(filterDB: FilterDatabase) {
    this.filterDB = filterDB
  }

  // Filter 생성
  createFilter(dto: CreateFilterDTO): Filter {
    const now = Date.now()

    const filter: Filter = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      mode: dto.mode,
      regex: dto.regex,
      wildcards: dto.wildcards,
      createdAt: now,
      updatedAt: now
    }

    this.filterDB.saveFilter(filter)
    return filter
  }

  // Filter 업데이트
  updateFilter(id: string, updates: Partial<CreateFilterDTO>): { success: boolean; error?: string } {
    const filter = this.filterDB.getFilter(id)

    if (!filter) {
      return { success: false, error: 'Filter를 찾을 수 없습니다.' }
    }

    const updatedFilter: Filter = {
      ...filter,
      name: updates.name ?? filter.name,
      description: updates.description ?? filter.description,
      mode: updates.mode ?? filter.mode,
      regex: updates.regex ?? filter.regex,
      wildcards: updates.wildcards ?? filter.wildcards,
      updatedAt: Date.now()
    }

    this.filterDB.saveFilter(updatedFilter)
    return { success: true }
  }

  // Filter 조회
  getFilter(id: string): Filter | null {
    return this.filterDB.getFilter(id)
  }

  getAllFilters(): Filter[] {
    return this.filterDB.getAllFilters()
  }

  searchFilters(query: string): Filter[] {
    return this.filterDB.searchFilters(query)
  }

  // Filter 삭제
  deleteFilter(id: string): boolean {
    return this.filterDB.deleteFilter(id)
  }

  // Filter 검증
  validateFilter(filter: Filter): FilterValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 이름 검증
    if (!filter.name || filter.name.trim().length === 0) {
      errors.push('Filter 이름은 필수입니다.')
    }

    // regex 유효성 검증
    if (filter.regex) {
      try {
        new RegExp(filter.regex)
      } catch {
        errors.push(`유효하지 않은 정규표현식: ${filter.regex}`)
      }
    }

    // regex 또는 wildcards 중 하나 이상 존재 권고
    if (!filter.regex && (!filter.wildcards || filter.wildcards.length === 0)) {
      warnings.push('regex 또는 wildcards 중 하나 이상을 설정하는 것을 권장합니다.')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}
