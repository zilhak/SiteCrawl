/**
 * AppDatabase — 앱 전체 DB 연결의 단일 소유자
 *
 * 역할:
 *   1. better-sqlite3 연결을 열고 닫는 유일한 주체
 *   2. PipelineDatabase, TaskDatabase, HistoryDatabase(crawl_history)에
 *      동일한 DB 인스턴스를 전달
 *   3. 초기화/종료 생명주기를 명확하게 관리
 *
 * 사용 규칙:
 *   - open()은 앱 생명주기에서 최대 1번 호출 (경로 변경 시 close() 후 다시 open())
 *   - 외부에서 db 인스턴스를 직접 close() 하지 않는다
 *   - isOpen() 으로 현재 상태를 확인한다
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { PipelineDatabase } from './pipeline/database'
import { PipelineManager } from './pipeline/manager'
import { TaskDatabase } from './task/database'
import { TaskManager } from './task/manager'

export class AppDatabase {
  private db: Database.Database | null = null
  private dbPath: string = ''

  // 서브 모듈 (open 시 생성, close 시 null)
  private _pipelineDB: PipelineDatabase | null = null
  private _pipelineManager: PipelineManager | null = null
  private _taskDB: TaskDatabase | null = null
  private _taskManager: TaskManager | null = null

  // --- 접근자 ---

  get pipelineDB(): PipelineDatabase | null { return this._pipelineDB }
  get pipelineManager(): PipelineManager | null { return this._pipelineManager }
  get taskDB(): TaskDatabase | null { return this._taskDB }
  get taskManager(): TaskManager | null { return this._taskManager }

  /** 현재 열려있는 DB 인스턴스 (crawl_history 등 직접 쿼리용) */
  getDatabase(): Database.Database | null { return this.db }

  /** DB가 열려있는지 */
  isOpen(): boolean { return this.db !== null }

  /** 현재 DB 경로 */
  getPath(): string { return this.dbPath }

  // --- 생명주기 ---

  /**
   * DB를 열고 모든 서브 모듈을 초기화한다.
   *
   * 이미 같은 경로로 열려있으면 아무것도 하지 않는다.
   * 다른 경로로 열려있으면 먼저 닫고 새로 연다.
   *
   * @returns 성공 여부
   */
  open(storagePath: string): boolean {
    if (!storagePath || storagePath.trim() === '') {
      console.error('[AppDatabase] open() 실패: 빈 경로')
      return false
    }

    const targetDbPath = path.join(storagePath, 'sitecrawl.db')

    // 이미 같은 경로로 열려있으면 스킵
    if (this.db && this.dbPath === targetDbPath) {
      console.log('[AppDatabase] 이미 열려있음, 스킵:', targetDbPath)
      return true
    }

    // 다른 경로로 열려있으면 먼저 닫기
    if (this.db) {
      console.log('[AppDatabase] 다른 경로로 전환, 기존 연결 닫기:', this.dbPath)
      this.close()
    }

    // 디렉토리 생성
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true })
    }

    try {
      this.dbPath = targetDbPath
      this.db = new Database(this.dbPath)
      // DELETE 모드: 트랜잭션이 메인 DB 파일에 직접 기록됨
      this.db.pragma('journal_mode = DELETE')
      this.db.pragma('synchronous = FULL')
      // FK 활성화
      this.db.pragma('foreign_keys = ON')

      // crawl_history 테이블 (이전 HistoryDatabase의 역할)
      this.initHistoryTable()

      // 서브 모듈 초기화
      this._pipelineDB = new PipelineDatabase(this.db)
      this._pipelineManager = new PipelineManager(this._pipelineDB)
      this._taskDB = new TaskDatabase(this.db)
      this._taskManager = new TaskManager(this._taskDB)

      // 시작 시 상태 로깅
      const pCount = (this.db.prepare('SELECT COUNT(*) as c FROM pipelines').get() as { c: number }).c
      const tCount = (this.db.prepare('SELECT COUNT(*) as c FROM pipeline_tasks').get() as { c: number }).c
      console.log('[AppDatabase] open 완료:', targetDbPath)
      console.log('[AppDatabase] 상태 — pipelines:', pCount, 'pipeline_tasks:', tCount)

      return true
    } catch (err) {
      console.error('[AppDatabase] open() 실패:', err)
      this.db = null
      this.dbPath = ''
      return false
    }
  }

  /**
   * DB를 닫고 모든 서브 모듈 참조를 해제한다.
   */
  close(): void {
    if (!this.db) return

    // 종료 전 상태 로깅
    try {
      const pCount = (this.db.prepare('SELECT COUNT(*) as c FROM pipelines').get() as { c: number }).c
      const tCount = (this.db.prepare('SELECT COUNT(*) as c FROM pipeline_tasks').get() as { c: number }).c
      console.log('[AppDatabase] close 전 상태 — pipelines:', pCount, 'pipeline_tasks:', tCount)
    } catch { /* DB 이미 손상된 경우 무시 */ }

    try {
      this.db.close()
    } catch (err) {
      console.error('[AppDatabase] close() 오류:', err)
    }

    this.db = null
    this.dbPath = ''
    this._pipelineDB = null
    this._pipelineManager = null
    this._taskDB = null
    this._taskManager = null

    console.log('[AppDatabase] close 완료')
  }

  // --- crawl_history (이전 HistoryDatabase에서 이전) ---

  private initHistoryTable(): void {
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

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_url ON crawl_history(url);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON crawl_history(timestamp DESC);
    `)
  }

  saveHistory(history: {
    url: string
    title: string
    description: string
    linkCount: number
    timestamp: number
  }): number | null {
    if (!this.db) return null

    const result = this.db.prepare(`
      INSERT INTO crawl_history (url, title, description, linkCount, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      history.url,
      history.title,
      history.description,
      history.linkCount,
      history.timestamp
    )

    return result.lastInsertRowid as number
  }

  getAllHistory(): { id: number; url: string; title: string; description: string; linkCount: number; timestamp: number }[] {
    if (!this.db) return []
    return this.db.prepare('SELECT * FROM crawl_history ORDER BY timestamp DESC').all() as any[]
  }

  getHistoryByUrl(url: string): unknown[] {
    if (!this.db) return []
    return this.db.prepare('SELECT * FROM crawl_history WHERE url LIKE ? ORDER BY timestamp DESC').all(`%${url}%`)
  }

  getRecentHistory(limit: number = 10): unknown[] {
    if (!this.db) return []
    return this.db.prepare('SELECT * FROM crawl_history ORDER BY timestamp DESC LIMIT ?').all(limit)
  }

  deleteHistory(id: number): boolean {
    if (!this.db) return false
    return this.db.prepare('DELETE FROM crawl_history WHERE id = ?').run(id).changes > 0
  }

  clearAllHistory(): boolean {
    if (!this.db) return false
    this.db.prepare('DELETE FROM crawl_history').run()
    return true
  }
}
