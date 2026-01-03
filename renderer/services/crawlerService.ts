import type { CrawlResult, CrawlOptions } from '../types'

/**
 * Crawler API wrapper service
 */
export const crawlerService = {
  async startCrawl(url: string, useSession?: boolean, options?: CrawlOptions): Promise<CrawlResult> {
    if (!window.crawler) {
      throw new Error('Crawler API not available. This feature requires Electron environment.')
    }
    return window.crawler.startCrawl(url, useSession, options)
  },

  onProgress(callback: (data: unknown) => void): void {
    if (!window.crawler) {
      console.warn('Crawler API not available. Progress events will not be received.')
      return
    }
    window.crawler.onProgress(callback)
  },

  onComplete(callback: (data: CrawlResult) => void): void {
    if (!window.crawler) {
      console.warn('Crawler API not available. Complete events will not be received.')
      return
    }
    window.crawler.onComplete(callback)
  },

  onError(callback: (error: string) => void): void {
    if (!window.crawler) {
      console.warn('Crawler API not available. Error events will not be received.')
      return
    }
    window.crawler.onError(callback)
  }
}
