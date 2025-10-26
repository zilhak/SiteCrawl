import type { Pipeline, PipelineTask, ValidationResult, PipelineStats } from '../types'

/**
 * Pipeline API wrapper service
 */
export const pipelineService = {
  // CRUD
  async create(name: string, description?: string): Promise<Pipeline> {
    return window.pipeline.create(name, description)
  },

  async save(pipeline: Pipeline) {
    return window.pipeline.save(pipeline)
  },

  async get(id: string): Promise<Pipeline | null> {
    return window.pipeline.get(id)
  },

  async getAll(): Promise<Pipeline[]> {
    return window.pipeline.getAll()
  },

  async search(query: string): Promise<Pipeline[]> {
    return window.pipeline.search(query)
  },

  async delete(id: string): Promise<boolean> {
    return window.pipeline.delete(id)
  },

  // Task 관리
  async addTask(pipelineId: string, task: PipelineTask) {
    return window.pipeline.addTask(pipelineId, task)
  },

  async removeTask(pipelineId: string, taskName: string) {
    return window.pipeline.removeTask(pipelineId, taskName)
  },

  async updateTask(pipelineId: string, taskName: string, updates: Partial<PipelineTask>) {
    return window.pipeline.updateTask(pipelineId, taskName, updates)
  },

  // 검증 및 정보
  async validate(pipelineId: string): Promise<ValidationResult> {
    return window.pipeline.validate(pipelineId)
  },

  async getStats(pipelineId: string): Promise<PipelineStats | null> {
    return window.pipeline.getStats(pipelineId)
  },

  async clone(pipelineId: string, newName?: string): Promise<Pipeline | null> {
    return window.pipeline.clone(pipelineId, newName)
  }
}
