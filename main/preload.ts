import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('windowControl', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximized-changed', (_event, value) => callback(value))
  }
})

contextBridge.exposeInMainWorld('crawler', {
  startCrawl: (url: string, useSession?: boolean, options?: unknown) =>
    ipcRenderer.invoke('crawler:start', url, useSession, options),
  onProgress: (callback: (data: unknown) => void) => {
    ipcRenderer.on('crawler:progress', (_event, data) => callback(data))
  },
  onComplete: (callback: (data: unknown) => void) => {
    ipcRenderer.on('crawler:complete', (_event, data) => callback(data))
  },
  onError: (callback: (error: string) => void) => {
    ipcRenderer.on('crawler:error', (_event, error) => callback(error))
  }
})

contextBridge.exposeInMainWorld('storage', {
  selectPath: () => ipcRenderer.invoke('storage:select-path'),
  setPath: (path: string) => ipcRenderer.invoke('storage:set-path', path),
  isActive: () => ipcRenderer.invoke('storage:is-active'),
  getSavedPath: () => ipcRenderer.invoke('storage:get-saved-path')
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
  save: (pipeline: unknown) =>
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
  addTask: (pipelineId: string, task: unknown) =>
    ipcRenderer.invoke('pipeline:add-task', pipelineId, task),
  removeTask: (pipelineId: string, taskName: string) =>
    ipcRenderer.invoke('pipeline:remove-task', pipelineId, taskName),
  updateTask: (pipelineId: string, taskName: string, updates: unknown) =>
    ipcRenderer.invoke('pipeline:update-task', pipelineId, taskName, updates),

  // Validation & Info
  validate: (pipelineId: string) =>
    ipcRenderer.invoke('pipeline:validate', pipelineId),
  getStats: (pipelineId: string) =>
    ipcRenderer.invoke('pipeline:get-stats', pipelineId),
  clone: (pipelineId: string, newName?: string) =>
    ipcRenderer.invoke('pipeline:clone', pipelineId, newName),

  // 실행
  execute: (pipelineId: string, initialUrl: string) =>
    ipcRenderer.invoke('pipeline:execute', pipelineId, initialUrl),
  onExecutionProgress: (callback: (event: unknown) => void) => {
    ipcRenderer.on('pipeline:execution-progress', (_event, data) => callback(data))
  },
  onExecutionComplete: (callback: (result: unknown) => void) => {
    ipcRenderer.on('pipeline:execution-complete', (_event, result) => callback(result))
  },
  onExecutionError: (callback: (error: string) => void) => {
    ipcRenderer.on('pipeline:execution-error', (_event, error) => callback(error))
  }
})

contextBridge.exposeInMainWorld('task', {
  create: (dto: unknown) =>
    ipcRenderer.invoke('task:create', dto),
  update: (id: string, updates: unknown) =>
    ipcRenderer.invoke('task:update', id, updates),
  get: (id: string) =>
    ipcRenderer.invoke('task:get', id),
  getAll: () =>
    ipcRenderer.invoke('task:get-all'),
  getByCategory: (category: string) =>
    ipcRenderer.invoke('task:get-by-category', category),
  search: (query: string) =>
    ipcRenderer.invoke('task:search', query),
  delete: (id: string) =>
    ipcRenderer.invoke('task:delete', id),
  deleteMultiple: (ids: string[]) =>
    ipcRenderer.invoke('task:delete-multiple', ids),
  createQuick: (category: string) =>
    ipcRenderer.invoke('task:create-quick', category),
  getPaginated: (category: string, page: number, pageSize: number) =>
    ipcRenderer.invoke('task:get-paginated', category, page, pageSize),
  validate: (task: unknown) =>
    ipcRenderer.invoke('task:validate', task)
})

contextBridge.exposeInMainWorld('filter', {
  create: (dto: unknown) =>
    ipcRenderer.invoke('filter:create', dto),
  get: (id: string) =>
    ipcRenderer.invoke('filter:get', id),
  getAll: () =>
    ipcRenderer.invoke('filter:get-all'),
  update: (id: string, updates: unknown) =>
    ipcRenderer.invoke('filter:update', id, updates),
  delete: (id: string) =>
    ipcRenderer.invoke('filter:delete', id)
})
