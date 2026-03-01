/**
 * Filter 데이터베이스 관리
 */

import Database from 'better-sqlite3'
import type { Filter } from './types'

export class FilterDatabase {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.initialize()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        mode TEXT NOT NULL CHECK(mode IN ('whitelist', 'blacklist')),
        regex TEXT,
        wildcards TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_filters_name ON filters(name);
    `)
  }

  // Filter 저장
  saveFilter(filter: Filter): void {
    const existing = this.db.prepare(`SELECT id FROM filters WHERE id = ?`).get(filter.id)

    if (existing) {
      this.db.prepare(`
        UPDATE filters
        SET name = ?, description = ?, mode = ?, regex = ?, wildcards = ?, updated_at = ?
        WHERE id = ?
      `).run(
        filter.name,
        filter.description || null,
        filter.mode,
        filter.regex || null,
        filter.wildcards ? JSON.stringify(filter.wildcards) : null,
        filter.updatedAt,
        filter.id
      )
    } else {
      this.db.prepare(`
        INSERT INTO filters (id, name, description, mode, regex, wildcards, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        filter.id,
        filter.name,
        filter.description || null,
        filter.mode,
        filter.regex || null,
        filter.wildcards ? JSON.stringify(filter.wildcards) : null,
        filter.createdAt,
        filter.updatedAt
      )
    }
  }

  // Filter 조회
  getFilter(id: string): Filter | null {
    const stmt = this.db.prepare(`
      SELECT * FROM filters WHERE id = ?
    `)

    const row = stmt.get(id) as any
    if (!row) return null

    return this.rowToFilter(row)
  }

  // 모든 Filter 조회
  getAllFilters(): Filter[] {
    const stmt = this.db.prepare(`
      SELECT * FROM filters
      ORDER BY created_at DESC
    `)

    const rows = stmt.all() as any[]
    return rows.map(row => this.rowToFilter(row))
  }

  // Filter 삭제
  deleteFilter(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM filters WHERE id = ?`)
    const result = stmt.run(id)
    return result.changes > 0
  }

  // Filter 검색
  searchFilters(query: string): Filter[] {
    const stmt = this.db.prepare(`
      SELECT * FROM filters
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY created_at DESC
    `)

    const searchPattern = `%${query}%`
    const rows = stmt.all(searchPattern, searchPattern) as any[]
    return rows.map(row => this.rowToFilter(row))
  }

  // Filter 이름 존재 여부 확인
  filterNameExists(name: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM filters
      WHERE name = ?
    `)
    const { count } = stmt.get(name) as any
    return count > 0
  }

  // DB 행을 Filter 객체로 변환
  private rowToFilter(row: unknown): Filter {
    const r = row as any
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      mode: r.mode,
      regex: r.regex,
      wildcards: r.wildcards ? JSON.parse(r.wildcards) : undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }
  }
}
