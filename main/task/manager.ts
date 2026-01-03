/**
 * Task 관리자
 */

import { randomUUID } from 'crypto'
import type {
  Task,
  CrawlTask,
  ActionTask,
  AnyTask,
  CreateCrawlTaskDTO,
  CreateActionTaskDTO,
  TaskValidationResult
} from './types'
import { TaskDatabase } from './database'

export class TaskManager {
  private taskDB: TaskDatabase

  constructor(taskDB: TaskDatabase) {
    this.taskDB = taskDB
  }

  // 자동으로 중복되지 않는 이름 생성
  private generateUniqueName(category: 'crawl' | 'action'): string {
    let counter = 1
    let name = `new_task${counter}`

    while (this.taskDB.taskNameExists(name, category)) {
      counter++
      name = `new_task${counter}`
    }

    return name
  }

  // CrawlTask 생성
  createCrawlTask(dto: CreateCrawlTaskDTO): CrawlTask {
    const now = Date.now()

    const task: CrawlTask = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      category: 'crawl',
      config: {
        type: dto.type,
        patterns: dto.patterns,
        limit: dto.limit,
        includeAbsolutePaths: dto.includeAbsolutePaths ?? true,
        includeRelativePaths: dto.includeRelativePaths ?? true
      },
      createdAt: now,
      updatedAt: now
    }

    this.taskDB.saveTask(task)
    return task
  }

  // ActionTask 생성
  createActionTask(dto: CreateActionTaskDTO): ActionTask {
    const now = Date.now()

    const task: ActionTask = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      category: 'action',
      config: {
        action: dto.action,
        resultName: dto.resultName
      },
      createdAt: now,
      updatedAt: now
    }

    this.taskDB.saveTask(task)
    return task
  }

  // Task 업데이트
  updateCrawlTask(id: string, updates: Partial<CreateCrawlTaskDTO>): { success: boolean; error?: string } {
    const task = this.taskDB.getTask(id)

    if (!task) {
      return { success: false, error: 'Task를 찾을 수 없습니다.' }
    }

    if (task.category !== 'crawl') {
      return { success: false, error: 'CrawlTask가 아닙니다.' }
    }

    const updatedTask: CrawlTask = {
      ...task as CrawlTask,
      name: updates.name ?? task.name,
      description: updates.description ?? task.description,
      config: {
        type: updates.type ?? (task as CrawlTask).config.type,
        patterns: updates.patterns ?? (task as CrawlTask).config.patterns,
        limit: updates.limit ?? (task as CrawlTask).config.limit,
        includeAbsolutePaths: updates.includeAbsolutePaths ?? (task as CrawlTask).config.includeAbsolutePaths ?? true,
        includeRelativePaths: updates.includeRelativePaths ?? (task as CrawlTask).config.includeRelativePaths ?? true,
      },
      updatedAt: Date.now()
    }

    this.taskDB.saveTask(updatedTask)
    return { success: true }
  }

  updateActionTask(id: string, updates: Partial<CreateActionTaskDTO>): { success: boolean; error?: string } {
    const task = this.taskDB.getTask(id)

    if (!task) {
      return { success: false, error: 'Task를 찾을 수 없습니다.' }
    }

    if (task.category !== 'action') {
      return { success: false, error: 'ActionTask가 아닙니다.' }
    }

    const updatedTask: ActionTask = {
      ...task as ActionTask,
      name: updates.name ?? task.name,
      description: updates.description ?? task.description,
      config: {
        action: updates.action ?? (task as ActionTask).config.action,
        resultName: updates.resultName ?? (task as ActionTask).config.resultName
      },
      updatedAt: Date.now()
    }

    this.taskDB.saveTask(updatedTask)
    return { success: true }
  }

  // Task 조회
  getTask(id: string): AnyTask | null {
    return this.taskDB.getTask(id)
  }

  getAllTasks(): AnyTask[] {
    return this.taskDB.getAllTasks()
  }

  getCrawlTasks(): CrawlTask[] {
    return this.taskDB.getTasksByCategory('crawl') as CrawlTask[]
  }

  getActionTasks(): ActionTask[] {
    return this.taskDB.getTasksByCategory('action') as ActionTask[]
  }

  searchTasks(query: string): AnyTask[] {
    return this.taskDB.searchTasks(query)
  }

  // Task 삭제
  deleteTask(id: string): boolean {
    return this.taskDB.deleteTask(id)
  }

  // 여러 Task 삭제
  deleteTasks(ids: string[]): number {
    return this.taskDB.deleteTasks(ids)
  }

  // 빠른 CrawlTask 생성 (자동 이름)
  createQuickCrawlTask(): CrawlTask {
    const name = this.generateUniqueName('crawl')
    const now = Date.now()

    const task: CrawlTask = {
      id: randomUUID(),
      name,
      description: '',
      category: 'crawl',
      config: {
        type: 'whitelist',
        includeAbsolutePaths: true,
        includeRelativePaths: true,
        patterns: [],
        limit: -1
      },
      createdAt: now,
      updatedAt: now
    }

    this.taskDB.saveTask(task)
    return task
  }

  // 빠른 ActionTask 생성 (자동 이름)
  createQuickActionTask(): ActionTask {
    const name = this.generateUniqueName('action')
    const now = Date.now()

    const task: ActionTask = {
      id: randomUUID(),
      name,
      description: '',
      category: 'action',
      config: {
        action: '',
        resultName: ''
      },
      createdAt: now,
      updatedAt: now
    }

    this.taskDB.saveTask(task)
    return task
  }

  // 페이지네이션 조회
  getTasksPaginated(category: 'crawl' | 'action', page: number = 1, pageSize: number = 20) {
    return this.taskDB.getTasksPaginated(category, page, pageSize)
  }

  // Task 검증
  validateCrawlTask(task: CrawlTask): TaskValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 이름 검증
    if (!task.name || task.name.trim().length === 0) {
      errors.push('Task 이름은 필수입니다.')
    }

    // 패턴 검증
    if (!task.config.patterns || task.config.patterns.length === 0) {
      errors.push('최소 하나의 패턴이 필요합니다.')
    } else {
      // Regex 유효성 검증
      for (const pattern of task.config.patterns) {
        try {
          new RegExp(pattern)
        } catch (e) {
          errors.push(`유효하지 않은 정규식: ${pattern}`)
        }
      }
    }

    // Limit 검증
    if (task.config.limit < -1) {
      errors.push('Limit은 -1 이상이어야 합니다.')
    }

    if (task.config.limit === 0) {
      warnings.push('Limit이 0이면 결과가 비어있을 수 있습니다.')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  validateActionTask(task: ActionTask): TaskValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 이름 검증
    if (!task.name || task.name.trim().length === 0) {
      errors.push('Task 이름은 필수입니다.')
    }

    // Action 검증
    if (!task.config.action || task.config.action.trim().length === 0) {
      errors.push('Action은 필수입니다.')
    }

    // ResultName 검증
    if (!task.config.resultName || task.config.resultName.trim().length === 0) {
      errors.push('Result name은 필수입니다.')
    } else {
      // 경로 문자 검증 (위험한 문자 체크)
      const invalidChars = /[<>:"|?*]/
      if (invalidChars.test(task.config.resultName)) {
        errors.push('Result name에 유효하지 않은 문자가 포함되어 있습니다.')
      }

      // 상대 경로 확인
      if (task.config.resultName.includes('..')) {
        errors.push('Result name에 상위 디렉토리 참조(..)를 사용할 수 없습니다.')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}
