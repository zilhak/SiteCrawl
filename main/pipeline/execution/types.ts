/**
 * Pipeline 실행 관련 타입 정의
 */

import type { Page } from 'playwright'

// Task 간 전달되는 데이터
// urls는 strings를 상속하는 개념: urls가 필요한 곳에 strings도 호환
// empty는 _final_ 노드가 출력하는 특수 빈 타입: 대상 Task의 기대 입력에 맞게 자동 변환
export type TaskData =
  | { type: 'empty'; value: null }
  | { type: 'url'; value: string }
  | { type: 'strings'; value: string[] }
  | { type: 'urls'; value: string[] }
  | { type: 'page'; value: Page }

// 각 Task 카테고리가 기대하는 입력/출력 타입
// output이 'none'이면 터미널 노드 (출력 없음)
export const TASK_IO_MAP = {
  string_filter: { input: 'strings', output: 'strings' },
  page_navigation: { input: 'url', output: 'page' },
  link_extraction: { input: 'page', output: 'urls' },
  resource_extraction: { input: 'urls', output: 'urls' },
  string_db_save: { input: 'strings', output: 'strings' },
  string_display: { input: 'strings', output: 'strings' },
  result_save: { input: 'strings', output: 'none' },
  page_db_check: { input: 'page', output: 'page' },
  page_db_save: { input: 'page', output: 'page' }
} as const

// 노드 실행 결과
export interface NodeExecutionResult {
  taskName: string
  taskId: string
  category?: string
  success: boolean
  output: TaskData | null
  error?: string
  startedAt: number
  completedAt: number
}

// 실행 진행 이벤트
export interface ExecutionProgressEvent {
  executionId: string
  taskName: string
  taskId: string
  status: 'running' | 'completed' | 'failed'
  message: string
  timestamp: number
}

// 실행 최종 결과
export interface PipelineExecutionResult {
  executionId: string
  pipelineId: string
  status: 'completed' | 'failed' | 'partially_failed'
  results: NodeExecutionResult[]
  error?: string
  startedAt: number
  completedAt: number
}
