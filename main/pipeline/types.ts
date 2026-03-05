/**
 * Pipeline 관련 타입 정의
 */

// Task 카테고리 (pipeline 내에서도 사용)
export type PipelineTaskCategory = 'string_filter' | 'page_navigation' | 'link_extraction' | 'resource_extraction' | 'string_db_save' | 'string_display' | 'result_save' | 'page_db_check' | 'page_db_save'

// Pipeline Task (트리 노드) - JSON이 본체, Task 설정을 인라인으로 포함
export interface PipelineTask {
  name: string                    // Pipeline 내 고유 이름 (다른 Task가 참조)
  trigger: string                 // 실행 조건: '_run_' | '_final_' 또는 다른 Task의 name
  category: PipelineTaskCategory  // Task 카테고리
  taskConfig: Record<string, unknown>  // 카테고리별 config (인라인)
  taskId?: string                 // 기존 Task 참조 (하위 호환, 선택)
  phase?: 'process' | 'final'    // 실행 구간 (기본값: 'process')
}

// Pipeline 정의
export interface Pipeline {
  id: string
  name: string
  description?: string
  tasks: PipelineTask[]
  createdAt: number
  updatedAt: number
}

// 검증 결과
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// 실행 컨텍스트
export interface ExecutionContext {
  executionId: string
  pipelineId: string
  initialUrl: string
  completedTasks: Map<string, TaskResult>
  pendingTasks: Set<string>
  runningTasks: Set<string>
  startedAt: number
}

// Task 실행 결과
export interface TaskResult {
  taskName: string
  taskId: string
  data: any
  timestamp: number
  error?: string
}

// Pipeline 실행 결과
export interface ExecutionResult {
  executionId: string
  pipelineId: string
  status: 'completed' | 'failed' | 'running'
  results: TaskResult[]
  error?: string
  startedAt: number
  completedAt?: number
}

// 트리 노드
export interface TreeNode {
  name: string
  category: PipelineTaskCategory
  taskConfig: Record<string, unknown>
  trigger: string
  taskId?: string
  phase?: 'process' | 'final'
  children: TreeNode[]
  parent: TreeNode | null  // 부모는 항상 하나 (트리 구조)
}

// 트리 그래프
export interface TreeGraph {
  nodes: Map<string, TreeNode>
  root: TreeNode | null
}
