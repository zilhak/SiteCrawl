import { contextBridge, ipcRenderer } from 'electron'
import type { Settings } from '@interface/settings'

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: Settings) => ipcRenderer.invoke('set-settings', settings),
})
