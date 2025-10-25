export interface CrawlResult {
  url: string
  title: string
  description: string
  screenshot: string
  links: string[]
  timestamp: number
}

export interface DomainFilter {
  mode: 'whitelist' | 'blacklist'
  patterns: string[]
}

export interface DomainSettings {
  [domain: string]: DomainFilter
}

export interface CrawlOptions {
  includeAbsolutePaths?: boolean
  includeRelativePaths?: boolean
  domainSettings?: DomainSettings
}

declare global {
  interface Window {
    crawler: {
      startCrawl: (url: string, useSession?: boolean, options?: CrawlOptions) => Promise<CrawlResult>
      onProgress: (callback: (data: any) => void) => void
      onComplete: (callback: (data: CrawlResult) => void) => void
      onError: (callback: (error: string) => void) => void
    }
  }
}

export {}
