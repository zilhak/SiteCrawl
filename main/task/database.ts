/**
 * Task 데이터베이스 관리
 */

import Database from 'better-sqlite3'
import type { Task, CrawlTask, ActionTask, AnyTask } from './types'

export class TaskDatabase {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.initialize()
  }

  private initialize(): void {
    // Tasks 테이블
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL CHECK(category IN ('crawl', 'action')),
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

    // Task 정렬 순서 테이블
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_order (
        task_id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `)

    // 인덱스
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
      CREATE INDEX IF NOT EXISTS idx_tasks_name ON tasks(name);
      CREATE INDEX IF NOT EXISTS idx_task_order_category ON task_order(category, order_index);
    `)
  }

  // Task 저장
  saveTask(task: AnyTask): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (id, name, description, category, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      task.id,
      task.name,
      task.description || null,
      task.category,
      JSON.stringify(task.config),
      task.createdAt,
      task.updatedAt
    )

    // task_order에 없으면 추가 (새 task인 경우)
    const orderCheck = this.db.prepare(`SELECT task_id FROM task_order WHERE task_id = ?`).get(task.id)
    if (!orderCheck) {
      const maxOrder = this.db.prepare(`
        SELECT COALESCE(MAX(order_index), -1) as max_order
        FROM task_order
        WHERE category = ?
      `).get(task.category) as any

      this.db.prepare(`
        INSERT INTO task_order (task_id, category, order_index)
        VALUES (?, ?, ?)
      `).run(task.id, task.category, maxOrder.max_order + 1)
    }
  }

  // Task 조회
  getTask(id: string): AnyTask | null {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE id = ?
    `)

    const row = stmt.get(id) as any
    if (!row) return null

    return this.rowToTask(row)
  }

  // 모든 Task 조회
  getAllTasks(): AnyTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      ORDER BY created_at DESC
    `)

    const rows = stmt.all() as any[]
    return rows.map(row => this.rowToTask(row))
  }

  // 카테고리별 Task 조회
  getTasksByCategory(category: 'crawl' | 'action'): AnyTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE category = ?
      ORDER BY created_at DESC
    `)

    const rows = stmt.all(category) as any[]
    return rows.map(row => this.rowToTask(row))
  }

  // Task 검색
  searchTasks(query: string): AnyTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY created_at DESC
    `)

    const searchPattern = `%${query}%`
    const rows = stmt.all(searchPattern, searchPattern) as any[]
    return rows.map(row => this.rowToTask(row))
  }

  // Task 삭제
  deleteTask(id: string): boolean {
    // task_order도 함께 삭제 (CASCADE로 자동 삭제되지만 명시적으로)
    this.db.prepare(`DELETE FROM task_order WHERE task_id = ?`).run(id)
    const stmt = this.db.prepare(`DELETE FROM tasks WHERE id = ?`)
    const result = stmt.run(id)
    return result.changes > 0
  }

  // 여러 Task 삭제
  deleteTasks(ids: string[]): number {
    let deleted = 0
    for (const id of ids) {
      if (this.deleteTask(id)) {
        deleted++
      }
    }
    return deleted
  }

  // 카테고리별 페이지네이션 조회
  getTasksPaginated(category: 'crawl' | 'action', page: number, pageSize: number): {
    tasks: AnyTask[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  } {
    const offset = (page - 1) * pageSize

    // 전체 개수 조회
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks t
      INNER JOIN task_order o ON t.id = o.task_id
      WHERE t.category = ?
    `)
    const { count } = countStmt.get(category) as any

    // 페이지 데이터 조회 (order_index로 정렬)
    const stmt = this.db.prepare(`
      SELECT t.*
      FROM tasks t
      INNER JOIN task_order o ON t.id = o.task_id
      WHERE t.category = ?
      ORDER BY o.order_index ASC
      LIMIT ? OFFSET ?
    `)

    const rows = stmt.all(category, pageSize, offset) as any[]
    const tasks = rows.map(row => this.rowToTask(row))

    return {
      tasks,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    }
  }

  // Task 이름 존재 여부 확인
  taskNameExists(name: string, category: 'crawl' | 'action'): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE name = ? AND category = ?
    `)
    const { count } = stmt.get(name, category) as any
    return count > 0
  }

  // DB 행을 Task 객체로 변환
  private rowToTask(row: unknown): AnyTask {
    const r = row as any
    const baseTask = {
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      config: JSON.parse(r.config),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }

    return baseTask as AnyTask
  }
}
