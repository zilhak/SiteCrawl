import type { Settings } from './interface/settings'

declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<Settings>
      setSettings: (settings: Settings) => Promise<void>
    }
  }
}

export {} 