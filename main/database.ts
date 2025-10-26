import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'

export interface CrawlHistory {
  id?: number
  url: string
  title: string
  description: string
  linkCount: number
  timestamp: number
}

export class HistoryDatabase {
  private db: Database.Database | null = null
  private dbPath: string = ''

  // 데이터베이스 경로 설정 및 초기화
  setDatabasePath(storagePath: string): void {
    if (!storagePath) {
      this.close()
      return
    }

    // 디렉토리 생성
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true })
    }

    this.dbPath = path.join(storagePath, 'sitecrawl.db')
    this.db = new Database(this.dbPath)
    this.initialize()
  }

  // 데이터베이스 인스턴스 반환 (PipelineDatabase 등에서 사용)
  getDatabase(): Database.Database | null {
    return this.db
  }

  // 데이터베이스 초기화 (테이블 생성)
  private initialize(): void {
    if (!this.db) return

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS crawl_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        description TEXT,
        linkCount INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      )
    `)

    // 인덱스 생성 (검색 성능 향상)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_url ON crawl_history(url);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON crawl_history(timestamp DESC);
    `)
  }

  // 크롤링 히스토리 저장
  saveHistory(history: CrawlHistory): number | null {
    if (!this.db) return null

    const stmt = this.db.prepare(`
      INSERT INTO crawl_history (url, title, description, linkCount, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      history.url,
      history.title,
      history.description,
      history.linkCount,
      history.timestamp
    )

    return result.lastInsertRowid as number
  }

  // 모든 히스토리 조회 (최신순)
  getAllHistory(): CrawlHistory[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT * FROM crawl_history
      ORDER BY timestamp DESC
    `)

    return stmt.all() as CrawlHistory[]
  }

  // URL로 히스토리 검색
  getHistoryByUrl(url: string): CrawlHistory[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT * FROM crawl_history
      WHERE url LIKE ?
      ORDER BY timestamp DESC
    `)

    return stmt.all(`%${url}%`) as CrawlHistory[]
  }

  // 최근 N개 히스토리 조회
  getRecentHistory(limit: number = 10): CrawlHistory[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT * FROM crawl_history
      ORDER BY timestamp DESC
      LIMIT ?
    `)

    return stmt.all(limit) as CrawlHistory[]
  }

  // 히스토리 삭제
  deleteHistory(id: number): boolean {
    if (!this.db) return false

    const stmt = this.db.prepare(`
      DELETE FROM crawl_history WHERE id = ?
    `)

    const result = stmt.run(id)
    return result.changes > 0
  }

  // 모든 히스토리 삭제
  clearAllHistory(): boolean {
    if (!this.db) return false

    const stmt = this.db.prepare(`DELETE FROM crawl_history`)
    stmt.run()
    return true
  }

  // 데이터베이스 활성화 여부
  isActive(): boolean {
    return this.db !== null
  }

  // 데이터베이스 닫기
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
