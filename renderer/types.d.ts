export interface CrawlResult {
  url: string
  title: string
  description: string
  screenshot: string
  links: string[]
  timestamp: number
}

export interface DomainFilter {
  mode: 'whitelist' | 'blacklist'
  patterns: string[]
}

export interface DomainSettings {
  [domain: string]: DomainFilter
}

export interface CrawlOptions {
  includeAbsolutePaths?: boolean
  includeRelativePaths?: boolean
  domainSettings?: DomainSettings
}

export interface CrawlHistory {
  id?: number
  url: string
  title: string
  description: string
  linkCount: number
  timestamp: number
}

export interface PipelineTask {
  taskId: string
  name: string
  trigger: string
  config?: string
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
  taskCount: number
  depth: number
  branches: number
  leafNodes: number
}

// Task 타입
export interface Task {
  id: string
  name: string
  description?: string
  category: 'crawl' | 'action'
  createdAt: number
  updatedAt: number
}

export interface CrawlTask extends Task {
  category: 'crawl'
  config: {
    type: 'blacklist' | 'whitelist'
    patterns: string[]
    limit: number
    includeAbsolutePaths: boolean
    includeRelativePaths: boolean
  }
}

// Action 타입 정의
export type ActionType = 'store'

// Action별 설정
export interface StoreActionConfig {
  type: 'store'
  path: string  // 저장 경로 (store/ 하위 경로)
}

// ActionConfig 유니온 타입
export type ActionConfig = StoreActionConfig

export interface ActionTask extends Task {
  category: 'action'
  config: ActionConfig
}

export type AnyTask = CrawlTask | ActionTask

export interface CreateCrawlTaskDTO {
  name: string
  description?: string
  type: 'blacklist' | 'whitelist'
  includeAbsolutePaths?: boolean
  includeRelativePaths?: boolean
  patterns: string[]
  limit: number
}

export interface CreateActionTaskDTO {
  name: string
  description?: string
  type: ActionType
  path: string
}

export interface TaskValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface TaskPaginationResult {
  tasks: AnyTask[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

declare global {
  interface Window {
    crawler: {
      startCrawl: (url: string, useSession?: boolean, options?: CrawlOptions) => Promise<CrawlResult>
      onProgress: (callback: (data: unknown) => void) => void
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
      save: (pipeline: Pipeline) => Promise<{ success: boolean; error?: string }>
      get: (id: string) => Promise<Pipeline | null>
      getAll: () => Promise<Pipeline[]>
      search: (query: string) => Promise<Pipeline[]>
      delete: (id: string) => Promise<boolean>
      addTask: (pipelineId: string, task: PipelineTask) => Promise<{ success: boolean; error?: string }>
      removeTask: (pipelineId: string, taskName: string) => Promise<{ success: boolean; error?: string }>
      updateTask: (pipelineId: string, taskName: string, updates: Partial<PipelineTask>) => Promise<{ success: boolean; error?: string }>
      validate: (pipelineId: string) => Promise<ValidationResult>
      getStats: (pipelineId: string) => Promise<PipelineStats | null>
      clone: (pipelineId: string, newName?: string) => Promise<Pipeline | null>
    }
    task: {
      createCrawl: (dto: CreateCrawlTaskDTO) => Promise<CrawlTask>
      updateCrawl: (id: string, updates: Partial<CreateCrawlTaskDTO>) => Promise<{ success: boolean; error?: string }>
      createAction: (dto: CreateActionTaskDTO) => Promise<ActionTask>
      updateAction: (id: string, updates: Partial<CreateActionTaskDTO>) => Promise<{ success: boolean; error?: string }>
      get: (id: string) => Promise<AnyTask | null>
      getAll: () => Promise<AnyTask[]>
      getCrawl: () => Promise<CrawlTask[]>
      getAction: () => Promise<ActionTask[]>
      search: (query: string) => Promise<AnyTask[]>
      delete: (id: string) => Promise<boolean>
      deleteMultiple: (ids: string[]) => Promise<number>
      createQuickCrawl: () => Promise<CrawlTask>
      createQuickAction: () => Promise<ActionTask>
      getPaginated: (category: 'crawl' | 'action', page: number, pageSize: number) => Promise<TaskPaginationResult>
      validateCrawl: (task: CrawlTask) => Promise<TaskValidationResult>
      validateAction: (task: ActionTask) => Promise<TaskValidationResult>
    }
  }
}

export {}
