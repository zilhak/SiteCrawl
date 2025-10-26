/**
 * Pipeline 관리자
 */

import { Pipeline, PipelineTask, ValidationResult } from './types'
import { DAG } from './dag'
import { PipelineValidator } from './validator'
import { PipelineDatabase } from './database'

export class PipelineManager {
  private db: PipelineDatabase
  private validator: PipelineValidator

  constructor(db: PipelineDatabase) {
    this.db = db
    this.validator = new PipelineValidator()
  }

  /**
   * Pipeline 생성
   */
  createPipeline(name: string, description?: string): Pipeline {
    const now = Date.now()

    const pipeline: Pipeline = {
      id: this.generateId(),
      name,
      description,
      tasks: [],
      createdAt: now,
      updatedAt: now
    }

    return pipeline
  }

  /**
   * Pipeline 저장
   */
  savePipeline(pipeline: Pipeline): { success: boolean; error?: string } {
    // 검증
    const validation = this.validator.validate(pipeline)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      }
    }

    try {
      pipeline.updatedAt = Date.now()
      this.db.savePipeline(pipeline)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Pipeline 조회
   */
  getPipeline(id: string): Pipeline | null {
    return this.db.getPipeline(id)
  }

  /**
   * 모든 Pipeline 조회
   */
  getAllPipelines(): Pipeline[] {
    return this.db.getAllPipelines()
  }

  /**
   * Pipeline 검색
   */
  searchPipelines(query: string): Pipeline[] {
    return this.db.searchPipelines(query)
  }

  /**
   * Pipeline 삭제
   */
  deletePipeline(id: string): boolean {
    return this.db.deletePipeline(id)
  }

  /**
   * Task 추가
   */
  addTask(
    pipelineId: string,
    task: PipelineTask
  ): { success: boolean; error?: string; warnings?: string[] } {
    const pipeline = this.getPipeline(pipelineId)
    if (!pipeline) {
      return { success: false, error: 'Pipeline not found' }
    }

    // 추가 가능 여부 검증
    const validation = this.validator.canAddTask(pipeline, task)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
        warnings: validation.warnings
      }
    }

    pipeline.tasks.push(task)
    const saveResult = this.savePipeline(pipeline)

    return {
      ...saveResult,
      warnings: validation.warnings
    }
  }

  /**
   * Task 제거
   */
  removeTask(
    pipelineId: string,
    taskName: string
  ): { success: boolean; error?: string; warnings?: string[] } {
    const pipeline = this.getPipeline(pipelineId)
    if (!pipeline) {
      return { success: false, error: 'Pipeline not found' }
    }

    // 제거 가능 여부 검증
    const validation = this.validator.canRemoveTask(pipeline, taskName)

    pipeline.tasks = pipeline.tasks.filter(t => t.name !== taskName)
    const saveResult = this.savePipeline(pipeline)

    return {
      ...saveResult,
      warnings: validation.warnings
    }
  }

  /**
   * Task 업데이트
   */
  updateTask(
    pipelineId: string,
    taskName: string,
    updates: Partial<PipelineTask>
  ): { success: boolean; error?: string; warnings?: string[] } {
    const pipeline = this.getPipeline(pipelineId)
    if (!pipeline) {
      return { success: false, error: 'Pipeline not found' }
    }

    const taskIndex = pipeline.tasks.findIndex(t => t.name === taskName)
    if (taskIndex === -1) {
      return { success: false, error: 'Task not found' }
    }

    // Trigger 변경 시 검증
    if (updates.trigger && updates.trigger !== pipeline.tasks[taskIndex].trigger) {
      const validation = this.validator.canChangeTrigger(
        pipeline,
        taskName,
        updates.trigger
      )
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          warnings: validation.warnings
        }
      }
    }

    // 업데이트 적용
    pipeline.tasks[taskIndex] = {
      ...pipeline.tasks[taskIndex],
      ...updates
    }

    const saveResult = this.savePipeline(pipeline)
    return saveResult
  }

  /**
   * Pipeline을 DAG로 변환
   */
  getPipelineAsDAG(pipelineId: string): DAG | null {
    const pipeline = this.getPipeline(pipelineId)
    if (!pipeline) return null

    try {
      return DAG.fromPipeline(pipeline)
    } catch (error) {
      console.error('Failed to create DAG:', error)
      return null
    }
  }

  /**
   * Pipeline 검증
   */
  validatePipeline(pipelineId: string): ValidationResult {
    const pipeline = this.getPipeline(pipelineId)
    if (!pipeline) {
      return {
        valid: false,
        errors: ['Pipeline not found'],
        warnings: []
      }
    }

    return this.validator.validate(pipeline)
  }

  /**
   * Pipeline 복제
   */
  clonePipeline(pipelineId: string, newName?: string): Pipeline | null {
    const original = this.getPipeline(pipelineId)
    if (!original) return null

    const now = Date.now()
    const cloned: Pipeline = {
      ...original,
      id: this.generateId(),
      name: newName || `${original.name} (복사본)`,
      createdAt: now,
      updatedAt: now
    }

    this.db.savePipeline(cloned)
    return cloned
  }

  /**
   * Pipeline 통계
   */
  getPipelineStats(pipelineId: string): {
    totalTasks: number
    entryPoints: number
    leafNodes: number
    maxDepth: number
  } | null {
    const dag = this.getPipelineAsDAG(pipelineId)
    if (!dag) return null

    const nodes = dag.getAllNodes()
    const leafNodes = dag.getLeafNodes()
    const root = dag.getRoot()

    // 최대 깊이 계산 (DFS)
    let maxDepth = 0
    if (root) {
      const calculateDepth = (node: any, depth: number): void => {
        maxDepth = Math.max(maxDepth, depth)
        for (const child of node.children) {
          calculateDepth(child, depth + 1)
        }
      }
      calculateDepth(root, 0)
    }

    return {
      totalTasks: nodes.length,
      entryPoints: root ? 1 : 0,
      leafNodes: leafNodes.length,
      maxDepth
    }
  }

  /**
   * ID 생성
   */
  private generateId(): string {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
