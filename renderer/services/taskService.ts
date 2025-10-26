import type { CrawlTask, ActionTask, AnyTask, TaskPaginationResult, CreateCrawlTaskDTO, CreateActionTaskDTO, TaskValidationResult } from '../types'

/**
 * Task API wrapper service
 */
export const taskService = {
  // CrawlTask 관련
  async createCrawl(dto: CreateCrawlTaskDTO): Promise<CrawlTask> {
    return window.task.createCrawl(dto)
  },

  async updateCrawl(id: string, updates: Partial<CreateCrawlTaskDTO>) {
    return window.task.updateCrawl(id, updates)
  },

  async createQuickCrawl(): Promise<CrawlTask> {
    return window.task.createQuickCrawl()
  },

  async getCrawlTasks(): Promise<CrawlTask[]> {
    return window.task.getCrawl()
  },

  // ActionTask 관련
  async createAction(dto: CreateActionTaskDTO): Promise<ActionTask> {
    return window.task.createAction(dto)
  },

  async updateAction(id: string, updates: Partial<CreateActionTaskDTO>) {
    return window.task.updateAction(id, updates)
  },

  async createQuickAction(): Promise<ActionTask> {
    return window.task.createQuickAction()
  },

  async getActionTasks(): Promise<ActionTask[]> {
    return window.task.getAction()
  },

  // 공통 조회
  async getTask(id: string): Promise<AnyTask | null> {
    return window.task.get(id)
  },

  async getAllTasks(): Promise<AnyTask[]> {
    return window.task.getAll()
  },

  async searchTasks(query: string): Promise<AnyTask[]> {
    return window.task.search(query)
  },

  async getTasksPaginated(
    category: 'crawl' | 'action',
    page: number = 1,
    pageSize: number = 20
  ): Promise<TaskPaginationResult> {
    return window.task.getPaginated(category, page, pageSize)
  },

  // 삭제
  async deleteTask(id: string): Promise<boolean> {
    return window.task.delete(id)
  },

  async deleteMultipleTasks(ids: string[]): Promise<number> {
    return window.task.deleteMultiple(ids)
  },

  // 검증
  async validateCrawlTask(task: CrawlTask): Promise<TaskValidationResult> {
    return window.task.validateCrawl(task)
  },

  async validateActionTask(task: ActionTask): Promise<TaskValidationResult> {
    return window.task.validateAction(task)
  }
}
