import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('crawler', {
  startCrawl: (url: string) => ipcRenderer.invoke('crawler:start', url),
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
