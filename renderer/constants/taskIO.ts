/**
 * Task IO 매핑 상수 (renderer용)
 * main/pipeline/execution/types.ts의 TASK_IO_MAP과 동일
 */

import type { TaskCategory } from '../types'

export const TASK_IO_MAP: Record<TaskCategory, { input: string; output: string }> = {
  string_filter: { input: 'strings', output: 'strings' },
  page_navigation: { input: 'url', output: 'page' },
  link_extraction: { input: 'page', output: 'urls' },
  resource_extraction: { input: 'urls', output: 'urls' },
  string_db_save: { input: 'strings', output: 'strings' }
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  string_filter: '문자열 필터',
  page_navigation: '페이지 이동',
  link_extraction: '링크 추출',
  resource_extraction: '리소스 추출',
  string_db_save: 'DB 저장'
}

export const CATEGORY_COLORS: Record<TaskCategory, 'warning' | 'info' | 'success' | 'secondary'> = {
  string_filter: 'warning',
  page_navigation: 'info',
  link_extraction: 'success',
  resource_extraction: 'secondary',
  string_db_save: 'warning'
}

export const IO_TYPE_LABELS: Record<string, string> = {
  url: 'URL (단일)',
  urls: 'URL 배열',
  strings: '문자열 배열',
  page: 'Page (브라우저)'
}
