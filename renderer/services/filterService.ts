import type { Filter } from '../types'

const checkFilterAPI = () => {
  if (!window.filter) {
    throw new Error('Filter API not available. This feature requires Electron environment.')
  }
}

export const filterService = {
  async create(dto: unknown): Promise<Filter> {
    checkFilterAPI()
    return window.filter.create(dto)
  },

  async get(id: string): Promise<Filter | null> {
    checkFilterAPI()
    return window.filter.get(id)
  },

  async getAll(): Promise<Filter[]> {
    checkFilterAPI()
    return window.filter.getAll()
  },

  async update(id: string, updates: unknown) {
    checkFilterAPI()
    return window.filter.update(id, updates)
  },

  async delete(id: string): Promise<boolean> {
    checkFilterAPI()
    return window.filter.delete(id)
  }
}
