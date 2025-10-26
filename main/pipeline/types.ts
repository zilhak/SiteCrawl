/**
 * Pipeline 관련 타입 정의
 */

// Pipeline Task (DAG 노드)
export interface PipelineTask {
  taskId: string        // 실행할 Task의 ID
  name: string          // Pipeline 내 고유 이름 (다른 Task가 참조)
  trigger: string       // 실행 조건: '_run_' 또는 다른 Task의 name
  config?: string       // Task별 설정 (JSON string)
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
  taskId: string
  trigger: string
  config?: any
  children: DAGNode[]
  parents: DAGNode[]
}

// DAG 그래프
export interface DAGGraph {
  nodes: Map<string, DAGNode>
  root: DAGNode | null
}
