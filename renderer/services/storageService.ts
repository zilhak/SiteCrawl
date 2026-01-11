/**
 * Storage API wrapper service
 */
export const storageService = {
  async selectPath(): Promise<string | null> {
    if (!window.storage) {
      throw new Error('Storage API not available. This feature requires Electron environment.')
    }
    return window.storage.selectPath()
  },

  async setPath(path: string): Promise<boolean> {
    if (!window.storage) {
      throw new Error('Storage API not available. This feature requires Electron environment.')
    }
    return window.storage.setPath(path)
  },

  async isActive(): Promise<boolean> {
    if (!window.storage) {
      console.warn('Storage API not available. Returning false.')
      return false
    }
    return window.storage.isActive()
  },

  async getSavedPath(): Promise<string> {
    if (!window.storage) {
      console.warn('Storage API not available. Returning empty string.')
      return ''
    }
    return window.storage.getSavedPath()
  }
}
