import type { Pipeline, PipelineTask, ValidationResult, PipelineStats } from '../types'

const checkPipelineAPI = () => {
  if (!window.pipeline) {
    throw new Error('Pipeline API not available. This feature requires Electron environment.')
  }
}

/**
 * Pipeline API wrapper service
 */
export const pipelineService = {
  // CRUD
  async create(name: string, description?: string): Promise<Pipeline> {
    checkPipelineAPI()
    return window.pipeline.create(name, description)
  },

  async save(pipeline: Pipeline) {
    checkPipelineAPI()
    return window.pipeline.save(pipeline)
  },

  async get(id: string): Promise<Pipeline | null> {
    checkPipelineAPI()
    return window.pipeline.get(id)
  },

  async getAll(): Promise<Pipeline[]> {
    checkPipelineAPI()
    return window.pipeline.getAll()
  },

  async search(query: string): Promise<Pipeline[]> {
    checkPipelineAPI()
    return window.pipeline.search(query)
  },

  async delete(id: string): Promise<boolean> {
    checkPipelineAPI()
    return window.pipeline.delete(id)
  },

  // Task 관리
  async addTask(pipelineId: string, task: PipelineTask) {
    checkPipelineAPI()
    return window.pipeline.addTask(pipelineId, task)
  },

  async removeTask(pipelineId: string, taskName: string) {
    checkPipelineAPI()
    return window.pipeline.removeTask(pipelineId, taskName)
  },

  async updateTask(pipelineId: string, taskName: string, updates: Partial<PipelineTask>) {
    checkPipelineAPI()
    return window.pipeline.updateTask(pipelineId, taskName, updates)
  },

  // 검증 및 정보
  async validate(pipelineId: string): Promise<ValidationResult> {
    checkPipelineAPI()
    return window.pipeline.validate(pipelineId)
  },

  async getStats(pipelineId: string): Promise<PipelineStats | null> {
    checkPipelineAPI()
    return window.pipeline.getStats(pipelineId)
  },

  async clone(pipelineId: string, newName?: string): Promise<Pipeline | null> {
    checkPipelineAPI()
    return window.pipeline.clone(pipelineId, newName)
  }
}
