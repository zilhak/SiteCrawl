import type { CrawlTask, ActionTask, AnyTask, TaskPaginationResult, CreateCrawlTaskDTO, CreateActionTaskDTO, TaskValidationResult } from '../types'

const checkTaskAPI = () => {
  if (!window.task) {
    throw new Error('Task API not available. This feature requires Electron environment.')
  }
}

/**
 * Task API wrapper service
 */
export const taskService = {
  // CrawlTask 관련
  async createCrawl(dto: CreateCrawlTaskDTO): Promise<CrawlTask> {
    checkTaskAPI()
    return window.task.createCrawl(dto)
  },

  async updateCrawl(id: string, updates: Partial<CreateCrawlTaskDTO>) {
    checkTaskAPI()
    return window.task.updateCrawl(id, updates)
  },

  async createQuickCrawl(): Promise<CrawlTask> {
    checkTaskAPI()
    return window.task.createQuickCrawl()
  },

  async getCrawlTasks(): Promise<CrawlTask[]> {
    checkTaskAPI()
    return window.task.getCrawl()
  },

  // ActionTask 관련
  async createAction(dto: CreateActionTaskDTO): Promise<ActionTask> {
    checkTaskAPI()
    return window.task.createAction(dto)
  },

  async updateAction(id: string, updates: Partial<CreateActionTaskDTO>) {
    checkTaskAPI()
    return window.task.updateAction(id, updates)
  },

  async createQuickAction(): Promise<ActionTask> {
    checkTaskAPI()
    return window.task.createQuickAction()
  },

  async getActionTasks(): Promise<ActionTask[]> {
    checkTaskAPI()
    return window.task.getAction()
  },

  // 공통 조회
  async getTask(id: string): Promise<AnyTask | null> {
    checkTaskAPI()
    return window.task.get(id)
  },

  async getAllTasks(): Promise<AnyTask[]> {
    checkTaskAPI()
    return window.task.getAll()
  },

  async searchTasks(query: string): Promise<AnyTask[]> {
    checkTaskAPI()
    return window.task.search(query)
  },

  async getTasksPaginated(
    category: 'crawl' | 'action',
    page: number = 1,
    pageSize: number = 20
  ): Promise<TaskPaginationResult> {
    checkTaskAPI()
    return window.task.getPaginated(category, page, pageSize)
  },

  // 삭제
  async deleteTask(id: string): Promise<boolean> {
    checkTaskAPI()
    return window.task.delete(id)
  },

  async deleteMultipleTasks(ids: string[]): Promise<number> {
    checkTaskAPI()
    return window.task.deleteMultiple(ids)
  },

  // 검증
  async validateCrawlTask(task: CrawlTask): Promise<TaskValidationResult> {
    checkTaskAPI()
    return window.task.validateCrawl(task)
  },

  async validateActionTask(task: ActionTask): Promise<TaskValidationResult> {
    checkTaskAPI()
    return window.task.validateAction(task)
  }
}
