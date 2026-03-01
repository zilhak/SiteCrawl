import type { AnyTask, TaskCategory } from '../types'

const checkTaskAPI = () => {
  if (!window.task) {
    throw new Error('Task API not available. This feature requires Electron environment.')
  }
}

/**
 * Task API wrapper service
 */
export const taskService = {
  // 생성
  async create(dto: unknown): Promise<AnyTask> {
    checkTaskAPI()
    return window.task.create(dto)
  },

  async createQuick(category: TaskCategory): Promise<AnyTask> {
    checkTaskAPI()
    return window.task.createQuick(category)
  },

  // 수정
  async update(id: string, updates: unknown) {
    checkTaskAPI()
    return window.task.update(id, updates)
  },

  // 조회
  async get(id: string): Promise<AnyTask | null> {
    checkTaskAPI()
    return window.task.get(id)
  },

  async getAll(): Promise<AnyTask[]> {
    checkTaskAPI()
    return window.task.getAll()
  },

  async getByCategory(category: TaskCategory): Promise<AnyTask[]> {
    checkTaskAPI()
    return window.task.getByCategory(category)
  },

  async search(query: string): Promise<AnyTask[]> {
    checkTaskAPI()
    return window.task.search(query)
  },

  async getPaginated(
    category: TaskCategory,
    page: number = 1,
    pageSize: number = 20
  ) {
    checkTaskAPI()
    return window.task.getPaginated(category, page, pageSize)
  },

  // 삭제
  async delete(id: string): Promise<boolean> {
    checkTaskAPI()
    return window.task.delete(id)
  },

  async deleteMultiple(ids: string[]): Promise<number> {
    checkTaskAPI()
    return window.task.deleteMultiple(ids)
  },

  // 검증
  async validate(task: unknown) {
    checkTaskAPI()
    return window.task.validate(task)
  }
}
