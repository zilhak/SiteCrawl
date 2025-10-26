/**
 * Storage API wrapper service
 */
export const storageService = {
  async selectPath(): Promise<string | null> {
    return window.storage.selectPath()
  },

  async setPath(path: string): Promise<boolean> {
    return window.storage.setPath(path)
  },

  async isActive(): Promise<boolean> {
    return window.storage.isActive()
  }
}
