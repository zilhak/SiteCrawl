import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('crawler', {
  startCrawl: (url: string, useSession?: boolean, options?: any) =>
    ipcRenderer.invoke('crawler:start', url, useSession, options),
  onProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('crawler:progress', (_event, data) => callback(data))
  },
  onComplete: (callback: (data: any) => void) => {
    ipcRenderer.on('crawler:complete', (_event, data) => callback(data))
  },
  onError: (callback: (error: string) => void) => {
    ipcRenderer.on('crawler:error', (_event, error) => callback(error))
  }
})

contextBridge.exposeInMainWorld('storage', {
  selectPath: () => ipcRenderer.invoke('storage:select-path'),
  setPath: (path: string) => ipcRenderer.invoke('storage:set-path', path),
  isActive: () => ipcRenderer.invoke('storage:is-active')
})

contextBridge.exposeInMainWorld('crawlHistory', {
  getAll: () => ipcRenderer.invoke('history:get-all'),
  getRecent: (limit?: number) => ipcRenderer.invoke('history:get-recent', limit),
  search: (url: string) => ipcRenderer.invoke('history:search', url),
  delete: (id: number) => ipcRenderer.invoke('history:delete', id),
  clear: () => ipcRenderer.invoke('history:clear')
})

contextBridge.exposeInMainWorld('pipeline', {
  // Pipeline CRUD
  create: (name: string, description?: string) =>
    ipcRenderer.invoke('pipeline:create', name, description),
  save: (pipeline: any) =>
    ipcRenderer.invoke('pipeline:save', pipeline),
  get: (id: string) =>
    ipcRenderer.invoke('pipeline:get', id),
  getAll: () =>
    ipcRenderer.invoke('pipeline:get-all'),
  search: (query: string) =>
    ipcRenderer.invoke('pipeline:search', query),
  delete: (id: string) =>
    ipcRenderer.invoke('pipeline:delete', id),

  // Task Management
  addTask: (pipelineId: string, task: any) =>
    ipcRenderer.invoke('pipeline:add-task', pipelineId, task),
  removeTask: (pipelineId: string, taskName: string) =>
    ipcRenderer.invoke('pipeline:remove-task', pipelineId, taskName),
  updateTask: (pipelineId: string, taskName: string, updates: any) =>
    ipcRenderer.invoke('pipeline:update-task', pipelineId, taskName, updates),

  // Validation & Info
  validate: (pipelineId: string) =>
    ipcRenderer.invoke('pipeline:validate', pipelineId),
  getStats: (pipelineId: string) =>
    ipcRenderer.invoke('pipeline:get-stats', pipelineId),
  clone: (pipelineId: string, newName?: string) =>
    ipcRenderer.invoke('pipeline:clone', pipelineId, newName)
})

contextBridge.exposeInMainWorld('task', {
  // CrawlTask
  createCrawl: (dto: any) =>
    ipcRenderer.invoke('task:create-crawl', dto),
  updateCrawl: (id: string, updates: any) =>
    ipcRenderer.invoke('task:update-crawl', id, updates),

  // ActionTask
  createAction: (dto: any) =>
    ipcRenderer.invoke('task:create-action', dto),
  updateAction: (id: string, updates: any) =>
    ipcRenderer.invoke('task:update-action', id, updates),

  // 조회
  get: (id: string) =>
    ipcRenderer.invoke('task:get', id),
  getAll: () =>
    ipcRenderer.invoke('task:get-all'),
  getCrawl: () =>
    ipcRenderer.invoke('task:get-crawl'),
  getAction: () =>
    ipcRenderer.invoke('task:get-action'),
  search: (query: string) =>
    ipcRenderer.invoke('task:search', query),

  // 삭제
  delete: (id: string) =>
    ipcRenderer.invoke('task:delete', id),
  deleteMultiple: (ids: string[]) =>
    ipcRenderer.invoke('task:delete-multiple', ids),

  // 빠른 생성
  createQuickCrawl: () =>
    ipcRenderer.invoke('task:create-quick-crawl'),
  createQuickAction: () =>
    ipcRenderer.invoke('task:create-quick-action'),

  // 페이지네이션
  getPaginated: (category: 'crawl' | 'action', page: number, pageSize: number) =>
    ipcRenderer.invoke('task:get-paginated', category, page, pageSize),

  // 검증
  validateCrawl: (task: any) =>
    ipcRenderer.invoke('task:validate-crawl', task),
  validateAction: (task: any) =>
    ipcRenderer.invoke('task:validate-action', task)
})
