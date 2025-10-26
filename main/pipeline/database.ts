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

    // Pipeline Tasks 테이블 (DAG 구조)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pipeline_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        name TEXT NOT NULL,
        trigger TEXT NOT NULL,
        config TEXT,
        FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
        UNIQUE(pipeline_id, name)
      )
    `)

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

    // 인덱스 생성
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_pipeline
        ON pipeline_tasks(pipeline_id);

      CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_trigger
        ON pipeline_tasks(pipeline_id, trigger);

      CREATE INDEX IF NOT EXISTS idx_pipeline_executions_pipeline
        ON pipeline_executions(pipeline_id, started_at DESC);
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
        INSERT INTO pipeline_tasks (pipeline_id, task_id, name, trigger, config)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (const task of pipeline.tasks) {
        taskStmt.run(
          pipeline.id,
          task.taskId,
          task.name,
          task.trigger,
          task.config || null
        )
      }
    })

    transaction()
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
      SELECT task_id, name, trigger, config
      FROM pipeline_tasks
      WHERE pipeline_id = ?
    `)
    const taskRows = tasksStmt.all(id) as any[]

    const tasks: PipelineTask[] = taskRows.map(row => ({
      taskId: row.task_id,
      name: row.name,
      trigger: row.trigger,
      config: row.config
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
  getExecutionHistory(pipelineId: string, limit: number = 10): any[] {
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
