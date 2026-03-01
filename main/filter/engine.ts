/**
 * Filter 엔진 - 필터 적용 로직
 */

import type { Filter } from './types'

export class FilterEngine {
  /**
   * Apply filter to string array (IMMUTABLE - returns new array)
   */
  static apply(input: string[], filter: Filter): string[] {
    // Input is never mutated
    return input.filter(item => {
      const matches = FilterEngine.matches(item, filter)
      // whitelist: keep if matches, blacklist: keep if NOT matches
      return filter.mode === 'whitelist' ? matches : !matches
    })
  }

  private static matches(item: string, filter: Filter): boolean {
    // If neither regex nor wildcards defined, nothing matches
    if (!filter.regex && (!filter.wildcards || filter.wildcards.length === 0)) {
      return false
    }

    // Check regex first
    if (filter.regex) {
      try {
        if (new RegExp(filter.regex, 'i').test(item)) return true
      } catch { /* invalid regex, skip */ }
    }

    // Check wildcards (OR with regex)
    if (filter.wildcards && filter.wildcards.length > 0) {
      for (const pattern of filter.wildcards) {
        if (FilterEngine.matchWildcard(item, pattern)) return true
      }
    }

    return false
  }

  private static matchWildcard(item: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${regexPattern}$`, 'i').test(item)
  }
}
