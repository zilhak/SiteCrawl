/**
 * Pipeline 실행 관련 타입 정의
 */

import type { Page } from 'playwright'

// Task 간 전달되는 데이터
export type TaskData =
  | { type: 'url'; value: string }
  | { type: 'strings'; value: string[] }
  | { type: 'page'; value: Page }

// 각 Task 카테고리가 기대하는 입력/출력 타입
export const TASK_IO_MAP = {
  string_filter: { input: 'strings', output: 'strings' },
  page_navigation: { input: 'url', output: 'page' },
  string_extraction: { input: 'page', output: 'strings' },
  resource_extraction: { input: 'strings', output: 'strings' }
} as const

// 노드 실행 결과
export interface NodeExecutionResult {
  taskName: string
  taskId: string
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
