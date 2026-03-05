/**
 * Task 관리자 (4종 통합)
 */

import { randomUUID } from 'crypto'
import type {
  Task,
  AnyTask,
  TaskCategory,
  CreateTaskDTO,
  TaskValidationResult,
  StringFilterTask,
  PageNavigationTask,
  LinkExtractionTask,
  ResourceExtractionTask,
  StringDbSaveTask,
  StringFilterConfig,
  PageNavigationConfig,
  LinkExtractionConfig,
  ResourceExtractionConfig,
  StringDbSaveConfig,
  StringDisplayTask,
  StringDisplayConfig,
  ResultSaveConfig,
  PageDbCheckConfig,
  PageDbSaveConfig
} from './types'
import { TaskDatabase } from './database'

export class TaskManager {
  private taskDB: TaskDatabase

  constructor(taskDB: TaskDatabase) {
    this.taskDB = taskDB
  }

  // 통합 Task 생성
  createTask(dto: CreateTaskDTO): AnyTask {
    const now = Date.now()
    const task: AnyTask = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
      category: dto.category,
      config: dto.config,
      createdAt: now,
      updatedAt: now
    } as AnyTask

    this.taskDB.saveTask(task)
    return task
  }

  // 빠른 Task 생성 (카테고리별 기본값)
  createQuickTask(category: TaskCategory): AnyTask {
    const name = this.generateUniqueName(category)
    const config = this.getDefaultConfig(category)
    return this.createTask({ name, category, config })
  }

  // Task 업데이트
  updateTask(id: string, updates: Partial<CreateTaskDTO>): { success: boolean; error?: string } {
    const task = this.taskDB.getTask(id)
    if (!task) {
      return { success: false, error: 'Task를 찾을 수 없습니다.' }
    }

    const updatedTask: AnyTask = {
      ...task,
      name: updates.name ?? task.name,
      description: updates.description ?? task.description,
      config: updates.config ?? task.config,
      updatedAt: Date.now()
    } as AnyTask

    this.taskDB.saveTask(updatedTask)
    return { success: true }
  }

  // 조회
  getTask(id: string): AnyTask | null {
    return this.taskDB.getTask(id)
  }

  getAllTasks(): AnyTask[] {
    return this.taskDB.getAllTasks()
  }

  getTasksByCategory(category: TaskCategory): AnyTask[] {
    return this.taskDB.getTasksByCategory(category)
  }

  searchTasks(query: string): AnyTask[] {
    return this.taskDB.searchTasks(query)
  }

  // 삭제
  deleteTask(id: string): boolean {
    return this.taskDB.deleteTask(id)
  }

  deleteTasks(ids: string[]): number {
    return this.taskDB.deleteTasks(ids)
  }

  // 페이지네이션
  getTasksPaginated(category: TaskCategory, page: number = 1, pageSize: number = 20) {
    return this.taskDB.getTasksPaginated(category, page, pageSize)
  }

  // Task 검증
  validateTask(task: AnyTask): TaskValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!task.name || task.name.trim().length === 0) {
      errors.push('Task 이름은 필수입니다.')
    }

    switch (task.category) {
      case 'string_filter': {
        const config = task.config as StringFilterConfig
        if (config.limit < -1) {
          errors.push('Limit은 -1 이상이어야 합니다.')
        }
        if (config.limit === 0) {
          warnings.push('Limit이 0이면 결과가 비어있을 수 있습니다.')
        }
        break
      }
      case 'page_navigation': {
        const config = task.config as PageNavigationConfig
        if (config.timeout <= 0) {
          errors.push('Timeout은 0보다 커야 합니다.')
        }
        break
      }
      case 'link_extraction': {
        const config = task.config as LinkExtractionConfig
        if (!config.includeHrefLinks && !config.includeTextUrls) {
          warnings.push('링크 추출 옵션이 모두 비활성화되어 있습니다.')
        }
        if (!config.includeAbsolutePaths && !config.includeRelativePaths) {
          errors.push('최소 하나의 경로 유형을 선택해야 합니다.')
        }
        break
      }
      case 'resource_extraction': {
        const config = task.config as ResourceExtractionConfig
        if (!config.resourceTypes || config.resourceTypes.length === 0) {
          errors.push('최소 하나의 리소스 타입을 선택해야 합니다.')
        }
        break
      }
      case 'string_db_save': {
        // 설정이 단순하여 특별한 검증 불필요
        break
      }
      case 'string_display': {
        // 설정이 단순하여 특별한 검증 불필요
        break
      }
      case 'result_save': {
        const config = task.config as ResultSaveConfig
        if (config.targetIndex === undefined || config.targetIndex === null) {
          errors.push('targetIndex가 필요합니다')
        } else if (typeof config.targetIndex !== 'number') {
          errors.push('targetIndex는 숫자여야 합니다')
        } else if (config.targetIndex < -1) {
          errors.push('targetIndex는 -1 이상이어야 합니다')
        }
        break
      }
      case 'page_db_check': {
        const config = task.config as PageDbCheckConfig
        if (!config.passCondition || !['exists', 'not_exists'].includes(config.passCondition)) {
          errors.push('passCondition은 "exists" 또는 "not_exists"여야 합니다')
        }
        break
      }
      case 'page_db_save': {
        // 특별한 검증 없음
        break
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  // 카테고리별 기본 설정
  private getDefaultConfig(category: TaskCategory): any {
    switch (category) {
      case 'string_filter':
        return { limit: -1 } as StringFilterConfig
      case 'page_navigation':
        return { waitUntil: 'domcontentloaded', timeout: 10000, handleCookies: true } as PageNavigationConfig
      case 'link_extraction':
        return { includeHrefLinks: true, includeTextUrls: false, includeAbsolutePaths: true, includeRelativePaths: true } as LinkExtractionConfig
      case 'resource_extraction':
        return { resourceTypes: ['image'] } as ResourceExtractionConfig
      case 'string_db_save':
        return { deduplication: false } as StringDbSaveConfig
      case 'string_display':
        return { label: '' } as StringDisplayConfig
      case 'result_save':
        return { targetIndex: -1 } as ResultSaveConfig
      case 'page_db_check':
        return { passCondition: 'not_exists' } as PageDbCheckConfig
      case 'page_db_save':
        return {} as PageDbSaveConfig
    }
  }

  private generateUniqueName(category: TaskCategory): string {
    let counter = 1
    let name = `new_task${counter}`
    while (this.taskDB.taskNameExists(name, category)) {
      counter++
      name = `new_task${counter}`
    }
    return name
  }
}
