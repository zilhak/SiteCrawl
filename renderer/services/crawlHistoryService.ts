import type { CrawlHistory } from '../types'

/**
 * Crawl History API wrapper service
 */
export const crawlHistoryService = {
  async getAll(): Promise<CrawlHistory[]> {
    return window.crawlHistory.getAll()
  },

  async getRecent(limit?: number): Promise<CrawlHistory[]> {
    return window.crawlHistory.getRecent(limit)
  },

  async search(url: string): Promise<CrawlHistory[]> {
    return window.crawlHistory.search(url)
  },

  async delete(id: number): Promise<boolean> {
    return window.crawlHistory.delete(id)
  },

  async clear(): Promise<boolean> {
    return window.crawlHistory.clear()
  }
}
