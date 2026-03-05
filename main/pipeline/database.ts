/**
 * Pipeline 데이터베이스 관리
 */

import Database from 'better-sqlite3'
import { Pipeline, PipelineTask } from './types'

export class PipelineDatabase {
  private db: Database.Database | null = null

  constructor(db: Database.Database) {
    this.db = db
    this.initialize()
  }

  /**
   * 테이블 초기화
   */
  private initialize(): void {
    if (!this.db) return

    // Pipelines 테이블
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // 스키마 마이그레이션: 이전 pipeline_tasks 테이블 드롭 (category 컬럼 없는 경우)
    try {
      const tableInfo = this.db.pragma('table_info(pipeline_tasks)') as { name: string }[]
      if (tableInfo.length > 0 && !tableInfo.some(col => col.name === 'category')) {
        console.log('[DEBUG:init] DROPPING pipeline_tasks (no category column)')
        this.db.exec('DROP TABLE IF EXISTS pipeline_tasks')
      }
    } catch { /* 테이블이 아예 없는 경우 무시 */ }

    // Pipeline Tasks 테이블 (DAG 구조) - JSON이 본체
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pipeline_id TEXT NOT NULL,
        name TEXT NOT NULL,
        trigger_name TEXT NOT NULL,
        category TEXT NOT NULL,
        task_config TEXT NOT NULL DEFAULT '{}',
        task_id TEXT,
        FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
        UNIQUE(pipeline_id, name)
      )
    `)

    // string_extraction → link_extraction 마이그레이션
    try {
      this.db.prepare(`UPDATE pipeline_tasks SET category = 'link_extraction' WHERE category = 'string_extraction'`).run()
    } catch { /* 테이블이 없으면 무시 */ }

    // phase 컬럼 마이그레이션 (process/final 구간 지원)
    try {
      const taskTableInfo = this.db.pragma('table_info(pipeline_tasks)') as { name: string }[]
      if (taskTableInfo.length > 0 && !taskTableInfo.some(col => col.name === 'phase')) {
        this.db.exec(`ALTER TABLE pipeline_tasks ADD COLUMN phase TEXT DEFAULT 'process'`)
        console.log('[DEBUG:init] Added phase column to pipeline_tasks')
      }
    } catch { /* 테이블이 없는 경우 무시 */ }

    // Pipeline 실행 히스토리
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_executions (
        id TEXT PRIMARY KEY,
        pipeline_id TEXT NOT NULL,
        initial_url TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        error TEXT,
        FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
      )
    `)

    // 저장된 문자열 테이블 (string_db_save 태스크용)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS saved_strings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pipeline_id TEXT NOT NULL,
        value TEXT NOT NULL,
        execution_id TEXT,
        saved_at INTEGER NOT NULL,
        FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
      )
    `)

    // 초기화 후 데이터 확인
    try {
      const pipelineCount = (this.db.prepare('SELECT COUNT(*) as cnt FROM pipelines').get() as any).cnt
      const taskCount = (this.db.prepare('SELECT COUNT(*) as cnt FROM pipeline_tasks').get() as any).cnt
      console.log('[DEBUG:init] after init - pipelines:', pipelineCount, 'tasks:', taskCount)
    } catch { /* ignore */ }

    // 인덱스 생성
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_pipeline
        ON pipeline_tasks(pipeline_id);

      CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_trigger
        ON pipeline_tasks(pipeline_id, trigger_name);

      CREATE INDEX IF NOT EXISTS idx_pipeline_executions_pipeline
        ON pipeline_executions(pipeline_id, started_at DESC);

      CREATE INDEX IF NOT EXISTS idx_saved_strings_pipeline
        ON saved_strings(pipeline_id);
    `)
  }

  /**
   * Pipeline 저장
   */
  savePipeline(pipeline: Pipeline): void {
    if (!this.db) throw new Error('Database not initialized')

    const transaction = this.db.transaction(() => {
      // Pipeline 기본 정보 저장
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO pipelines (id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)

      stmt.run(
        pipeline.id,
        pipeline.name,
        pipeline.description || null,
        pipeline.createdAt,
        pipeline.updatedAt
      )

      // 기존 Task 삭제
      const deleteStmt = this.db!.prepare(`
        DELETE FROM pipeline_tasks WHERE pipeline_id = ?
      `)
      deleteStmt.run(pipeline.id)

      // Task 저장
      const taskStmt = this.db!.prepare(`
        INSERT INTO pipeline_tasks (pipeline_id, name, trigger_name, category, task_config, task_id, phase)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const task of pipeline.tasks) {
        taskStmt.run(
          pipeline.id,
          task.name,
          task.trigger,
          task.category,
          JSON.stringify(task.taskConfig),
          task.taskId || null,
          task.phase || 'process'
        )
      }
    })

    transaction()
    console.log('[DEBUG:db] savePipeline transaction committed, id:', pipeline.id)
  }

  /**
   * Pipeline 조회 (ID로)
   */
  getPipeline(id: string): Pipeline | null {
    if (!this.db) return null

    // Pipeline 기본 정보
    const pipelineStmt = this.db.prepare(`
      SELECT * FROM pipelines WHERE id = ?
    `)
    const pipelineRow = pipelineStmt.get(id) as any

    if (!pipelineRow) return null

    // Tasks 조회
    const tasksStmt = this.db.prepare(`
      SELECT name, trigger_name, category, task_config, task_id, phase
      FROM pipeline_tasks
      WHERE pipeline_id = ?
    `)
    const taskRows = tasksStmt.all(id) as any[]

    const tasks: PipelineTask[] = taskRows.map(row => ({
      name: row.name,
      trigger: row.trigger_name,
      category: row.category,
      taskConfig: JSON.parse(row.task_config || '{}'),
      ...(row.task_id ? { taskId: row.task_id } : {}),
      ...(row.phase && row.phase !== 'process' ? { phase: row.phase } : {})
    }))

    return {
      id: pipelineRow.id,
      name: pipelineRow.name,
      description: pipelineRow.description,
      tasks,
      createdAt: pipelineRow.created_at,
      updatedAt: pipelineRow.updated_at
    }
  }

  /**
   * 모든 Pipeline 목록 조회
   */
  getAllPipelines(): Pipeline[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT * FROM pipelines ORDER BY updated_at DESC
    `)
    const rows = stmt.all() as any[]

    return rows.map(row => {
      const pipeline = this.getPipeline(row.id)
      return pipeline!
    }).filter(p => p !== null)
  }

  /**
   * Pipeline 삭제
   */
  deletePipeline(id: string): boolean {
    if (!this.db) return false

    const stmt = this.db.prepare(`
      DELETE FROM pipelines WHERE id = ?
    `)
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Pipeline 이름으로 검색
   */
  searchPipelines(query: string): Pipeline[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT * FROM pipelines
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY updated_at DESC
    `)
    const rows = stmt.all(`%${query}%`, `%${query}%`) as any[]

    return rows.map(row => this.getPipeline(row.id)).filter(p => p !== null) as Pipeline[]
  }

  /**
   * 실행 히스토리 저장
   */
  saveExecution(execution: {
    id: string
    pipelineId: string
    initialUrl: string
    status: string
    startedAt: number
    completedAt?: number
    error?: string
  }): void {
    if (!this.db) return

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pipeline_executions
      (id, pipeline_id, initial_url, status, started_at, completed_at, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      execution.id,
      execution.pipelineId,
      execution.initialUrl,
      execution.status,
      execution.startedAt,
      execution.completedAt || null,
      execution.error || null
    )
  }

  /**
   * Pipeline의 실행 히스토리 조회
   */
  getExecutionHistory(pipelineId: string, limit: number = 10): unknown[] {
    if (!this.db) return []

    const stmt = this.db.prepare(`
      SELECT * FROM pipeline_executions
      WHERE pipeline_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `)

    return stmt.all(pipelineId, limit) as any[]
  }

  /**
   * 문자열 DB 저장 (string_db_save 태스크용)
   */
  saveStrings(
    pipelineId: string,
    executionId: string,
    strings: string[],
    deduplication: boolean = false
  ): void {
    if (!this.db) return

    const now = Date.now()

    if (deduplication) {
      // 이미 저장된 문자열 조회
      const existing = new Set(
        (this.db.prepare(`SELECT value FROM saved_strings WHERE pipeline_id = ?`).all(pipelineId) as { value: string }[])
          .map(row => row.value)
      )
      const newStrings = strings.filter(s => !existing.has(s))

      const stmt = this.db.prepare(`
        INSERT INTO saved_strings (pipeline_id, value, execution_id, saved_at)
        VALUES (?, ?, ?, ?)
      `)
      for (const s of newStrings) {
        stmt.run(pipelineId, s, executionId, now)
      }
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO saved_strings (pipeline_id, value, execution_id, saved_at)
        VALUES (?, ?, ?, ?)
      `)
      for (const s of strings) {
        stmt.run(pipelineId, s, executionId, now)
      }
    }
  }

  /**
   * Pipeline에 저장된 문자열 조회
   */
  getSavedStrings(pipelineId: string): string[] {
    if (!this.db) return []

    const rows = this.db.prepare(`
      SELECT value FROM saved_strings
      WHERE pipeline_id = ?
      ORDER BY saved_at ASC
    `).all(pipelineId) as { value: string }[]

    return rows.map(row => row.value)
  }

  /**
   * Pipeline의 저장된 문자열 초기화
   */
  clearSavedStrings(pipelineId: string): void {
    if (!this.db) return
    this.db.prepare(`DELETE FROM saved_strings WHERE pipeline_id = ?`).run(pipelineId)
  }

  // ---- 방문 페이지 DB (page_db_check / page_db_save 태스크용) ----

  /**
   * 도메인명을 테이블명으로 변환
   * e.g., "example.com" → "visit_example_com"
   */
  private sanitizeDomainForTable(domain: string): string {
    return 'visit_' + domain.replace(/[^a-zA-Z0-9]/g, '_')
  }

  /**
   * 도메인별 방문 테이블 생성 (없으면)
   */
  private ensureVisitTable(domain: string): string {
    if (!this.db) throw new Error('Database not initialized')

    const tableName = this.sanitizeDomainForTable(domain)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        saved_at INTEGER NOT NULL
      )
    `)
    return tableName
  }

  /**
   * 페이지 방문 여부 확인
   */
  checkVisitedPage(domain: string, path: string): boolean {
    if (!this.db) return false

    const tableName = this.ensureVisitTable(domain)
    const row = this.db.prepare(`SELECT 1 FROM "${tableName}" WHERE path = ?`).get(path)
    return !!row
  }

  /**
   * 페이지 방문 기록 저장
   */
  saveVisitedPage(domain: string, path: string): void {
    if (!this.db) return

    const tableName = this.ensureVisitTable(domain)
    this.db.prepare(`
      INSERT OR IGNORE INTO "${tableName}" (path, saved_at) VALUES (?, ?)
    `).run(path, Date.now())
  }

  /**
   * 데이터베이스 활성화 여부
   */
  isActive(): boolean {
    return this.db !== null
  }

  /**
   * 데이터베이스 닫기
   */
  close(): void {
    // 주의: 이 클래스는 외부에서 전달받은 db를 사용하므로
    // 닫기는 외부에서 담당
  }
}
