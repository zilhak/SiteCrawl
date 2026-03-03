/**
 * Renderer 타입 선언
 */

// Crawl
export interface CrawlResult {
  url: string
  title: string
  description: string
  screenshot: string
  links: string[]
  timestamp: number
}

export interface CrawlOptions {
  includeAbsolutePaths?: boolean
  includeRelativePaths?: boolean
  domainSettings?: Record<string, { mode: 'whitelist' | 'blacklist'; patterns: string[] }>
}

export interface CrawlHistory {
  id?: number
  url: string
  title: string
  description: string
  linkCount: number
  timestamp: number
}

// Task
export type TaskCategory = 'string_filter' | 'page_navigation' | 'link_extraction' | 'resource_extraction'

export interface Task {
  id: string
  name: string
  description?: string
  category: TaskCategory
  config: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export type AnyTask = Task

// Pipeline
export interface PipelineTask {
  name: string                    // Pipeline 내 고유 이름
  trigger: string                 // 실행 조건: '_run_' 또는 다른 Task의 name
  category: TaskCategory          // Task 카테고리
  taskConfig: Record<string, unknown>  // 카테고리별 config (인라인)
  taskId?: string                 // 기존 Task 참조 (선택)
}

export interface Pipeline {
  id: string
  name: string
  description?: string
  tasks: PipelineTask[]
  createdAt: number
  updatedAt: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface PipelineStats {
  totalTasks: number
  entryPoints: number
  leafNodes: number
  maxDepth: number
}

// Pipeline Execution
export interface ExecutionProgressEvent {
  executionId: string
  taskName: string
  taskId: string
  status: 'running' | 'completed' | 'failed'
  message: string
  timestamp: number
}

export interface NodeExecutionResult {
  taskName: string
  taskId: string
  success: boolean
  output: { type: string; value: unknown } | null
  error?: string
  startedAt: number
  completedAt: number
}

export interface PipelineExecutionResult {
  executionId: string
  pipelineId: string
  status: 'completed' | 'failed' | 'partially_failed'
  results: NodeExecutionResult[]
  error?: string
  startedAt: number
  completedAt: number
}

// Window API declarations
declare global {
  interface Window {
    windowControl: {
      minimize: () => Promise<void>
      maximize: () => Promise<boolean>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      onMaximizedChange: (callback: (isMaximized: boolean) => void) => void
    }
    crawler: {
      startCrawl: (url: string, useSession?: boolean, options?: unknown) => Promise<CrawlResult>
      onProgress: (callback: (data: { message: string }) => void) => void
      onComplete: (callback: (data: CrawlResult) => void) => void
      onError: (callback: (error: string) => void) => void
    }
    storage: {
      selectPath: () => Promise<string | null>
      setPath: (path: string) => Promise<boolean>
      isActive: () => Promise<boolean>
      getSavedPath: () => Promise<string>
    }
    crawlHistory: {
      getAll: () => Promise<CrawlHistory[]>
      getRecent: (limit?: number) => Promise<CrawlHistory[]>
      search: (url: string) => Promise<CrawlHistory[]>
      delete: (id: number) => Promise<boolean>
      clear: () => Promise<boolean>
    }
    pipeline: {
      create: (name: string, description?: string) => Promise<Pipeline>
      save: (pipeline: unknown) => Promise<{ success: boolean; error?: string }>
      get: (id: string) => Promise<Pipeline | null>
      getAll: () => Promise<Pipeline[]>
      search: (query: string) => Promise<Pipeline[]>
      delete: (id: string) => Promise<boolean>
      addTask: (pipelineId: string, task: unknown) => Promise<{ success: boolean; error?: string; warnings?: string[] }>
      removeTask: (pipelineId: string, taskName: string) => Promise<{ success: boolean; error?: string; warnings?: string[] }>
      updateTask: (pipelineId: string, taskName: string, updates: unknown) => Promise<{ success: boolean; error?: string; warnings?: string[] }>
      validate: (pipelineId: string) => Promise<ValidationResult>
      getStats: (pipelineId: string) => Promise<PipelineStats | null>
      clone: (pipelineId: string, newName?: string) => Promise<Pipeline | null>
      execute: (pipelineId: string, initialUrl: string) => Promise<PipelineExecutionResult>
      onExecutionProgress: (callback: (event: ExecutionProgressEvent) => void) => void
      onExecutionComplete: (callback: (result: PipelineExecutionResult) => void) => void
      onExecutionError: (callback: (error: string) => void) => void
    }
    task: {
      create: (dto: unknown) => Promise<AnyTask>
      update: (id: string, updates: unknown) => Promise<{ success: boolean; error?: string }>
      get: (id: string) => Promise<AnyTask | null>
      getAll: () => Promise<AnyTask[]>
      getByCategory: (category: string) => Promise<AnyTask[]>
      search: (query: string) => Promise<AnyTask[]>
      delete: (id: string) => Promise<boolean>
      deleteMultiple: (ids: string[]) => Promise<number>
      createQuick: (category: string) => Promise<AnyTask>
      getPaginated: (category: string, page: number, pageSize: number) => Promise<{
        tasks: AnyTask[]
        total: number
        page: number
        pageSize: number
        totalPages: number
      }>
      validate: (task: unknown) => Promise<{ valid: boolean; errors: string[]; warnings: string[] }>
    }
  }
}

export {}
