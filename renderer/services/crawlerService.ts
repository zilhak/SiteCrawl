import type { CrawlResult, CrawlOptions } from '../types'

/**
 * Crawler API wrapper service
 */
export const crawlerService = {
  async startCrawl(url: string, useSession?: boolean, options?: CrawlOptions): Promise<CrawlResult> {
    return window.crawler.startCrawl(url, useSession, options)
  },

  onProgress(callback: (data: any) => void): void {
    window.crawler.onProgress(callback)
  },

  onComplete(callback: (data: CrawlResult) => void): void {
    window.crawler.onComplete(callback)
  },

  onError(callback: (error: string) => void): void {
    window.crawler.onError(callback)
  }
}
