/**
 * Task IO 매핑 상수 (renderer용)
 * main/pipeline/execution/types.ts의 TASK_IO_MAP과 동일
 */

import type { TaskCategory } from '../types'

export const TASK_IO_MAP: Record<TaskCategory, { input: string; output: string }> = {
  string_filter: { input: 'strings', output: 'strings' },
  page_navigation: { input: 'url', output: 'page' },
  string_extraction: { input: 'page', output: 'strings' },
  resource_extraction: { input: 'strings', output: 'strings' }
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  string_filter: '문자열 필터',
  page_navigation: '페이지 이동',
  string_extraction: '문자열 추출',
  resource_extraction: '리소스 추출'
}

export const CATEGORY_COLORS: Record<TaskCategory, 'warning' | 'info' | 'success' | 'secondary'> = {
  string_filter: 'warning',
  page_navigation: 'info',
  string_extraction: 'success',
  resource_extraction: 'secondary'
}

export const IO_TYPE_LABELS: Record<string, string> = {
  url: 'URL (단일)',
  strings: '문자열 배열',
  page: 'Page (브라우저)'
}
