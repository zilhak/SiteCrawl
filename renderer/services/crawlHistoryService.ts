import type { CrawlHistory } from '../types'

const checkCrawlHistoryAPI = () => {
  if (!window.crawlHistory) {
    throw new Error('Crawl History API not available. This feature requires Electron environment.')
  }
}

/**
 * Crawl History API wrapper service
 */
export const crawlHistoryService = {
  async getAll(): Promise<CrawlHistory[]> {
    checkCrawlHistoryAPI()
    return window.crawlHistory.getAll()
  },

  async getRecent(limit?: number): Promise<CrawlHistory[]> {
    checkCrawlHistoryAPI()
    return window.crawlHistory.getRecent(limit)
  },

  async search(url: string): Promise<CrawlHistory[]> {
    checkCrawlHistoryAPI()
    return window.crawlHistory.search(url)
  },

  async delete(id: number): Promise<boolean> {
    checkCrawlHistoryAPI()
    return window.crawlHistory.delete(id)
  },

  async clear(): Promise<boolean> {
    checkCrawlHistoryAPI()
    return window.crawlHistory.clear()
  }
}
