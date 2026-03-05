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
  string_db_save: { input: 'strings', output: 'strings' },
  string_display: { input: 'strings', output: 'strings' },
  result_save: { input: 'strings', output: 'none' },
  page_db_check: { input: 'page', output: 'page' },
  page_db_save: { input: 'page', output: 'page' }
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  string_filter: '문자열 필터',
  page_navigation: '페이지 이동',
  link_extraction: '링크 추출',
  resource_extraction: '리소스 추출',
  string_db_save: 'DB 저장',
  string_display: '화면 표시',
  result_save: 'Result 저장',
  page_db_check: '방문 체크',
  page_db_save: '방문 저장'
}

export const CATEGORY_COLORS: Record<TaskCategory, 'warning' | 'info' | 'success' | 'secondary' | 'error'> = {
  string_filter: 'warning',
  page_navigation: 'info',
  link_extraction: 'success',
  resource_extraction: 'secondary',
  string_db_save: 'warning',
  string_display: 'info',
  result_save: 'success',
  page_db_check: 'error',
  page_db_save: 'secondary'
}

export const IO_TYPE_LABELS: Record<string, string> = {
  url: 'URL (단일)',
  urls: 'URL 배열',
  strings: '문자열 배열',
  page: 'Page (브라우저)',
  none: '없음 (터미널)',
  empty: '비어있음'
}
