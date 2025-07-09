declare global {
  interface Window {
    electronAPI: {
      sendMessage: (message: string) => Promise<any>
      onMessage: (callback: (message: string) => void) => void
      getAppInfo: () => Promise<any>
      openFileDialog: () => Promise<any>
    }
  }
}

export {} 