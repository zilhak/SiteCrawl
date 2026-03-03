/**
 * Pipeline 관련 타입 정의
 */

// Task 카테고리 (pipeline 내에서도 사용)
export type PipelineTaskCategory = 'string_filter' | 'page_navigation' | 'link_extraction' | 'resource_extraction'

// Pipeline Task (DAG 노드) - JSON이 본체, Task 설정을 인라인으로 포함
export interface PipelineTask {
  name: string                    // Pipeline 내 고유 이름 (다른 Task가 참조)
  trigger: string                 // 실행 조건: '_run_' 또는 다른 Task의 name
  category: PipelineTaskCategory  // Task 카테고리
  taskConfig: Record<string, unknown>  // 카테고리별 config (인라인)
  taskId?: string                 // 기존 Task 참조 (하위 호환, 선택)
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

// DAG 노드
export interface DAGNode {
  name: string
  category: PipelineTaskCategory
  taskConfig: Record<string, unknown>
  trigger: string
  taskId?: string
  children: DAGNode[]
  parents: DAGNode[]
}

// DAG 그래프
export interface DAGGraph {
  nodes: Map<string, DAGNode>
  root: DAGNode | null
}
