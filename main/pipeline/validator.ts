/**
 * Pipeline 검증 시스템
 */

import { Pipeline, PipelineTask, ValidationResult } from './types'
import { DAG } from './dag'

export class PipelineValidator {
  /**
   * Pipeline 검증
   */
  validate(pipeline: Pipeline): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. 기본 검증
    if (!pipeline.name || pipeline.name.trim() === '') {
      errors.push('Pipeline 이름이 필요합니다')
    }

    if (!pipeline.tasks || pipeline.tasks.length === 0) {
      errors.push('최소 1개의 Task가 필요합니다')
      return { valid: false, errors, warnings }
    }

    // 2. Task name 유일성 검증
    const nameSet = new Set<string>()
    const duplicates: string[] = []

    for (const task of pipeline.tasks) {
      if (!task.name || task.name.trim() === '') {
        errors.push('Task 이름이 비어있습니다')
        continue
      }

      if (nameSet.has(task.name)) {
        duplicates.push(task.name)
      }
      nameSet.add(task.name)
    }

    if (duplicates.length > 0) {
      errors.push(`중복된 Task 이름: ${duplicates.join(', ')}`)
    }

    // 3. '_run_' trigger 검증
    const runTriggers = pipeline.tasks.filter(t => t.trigger === '_run_')

    if (runTriggers.length === 0) {
      errors.push('진입점이 없습니다. trigger가 "_run_"인 Task가 하나 필요합니다')
    } else if (runTriggers.length > 1) {
      errors.push(`진입점이 ${runTriggers.length}개입니다. "_run_" trigger는 하나만 가능합니다`)
    }

    // 4. Trigger 참조 유효성 검증
    for (const task of pipeline.tasks) {
      if (!task.trigger || task.trigger.trim() === '') {
        errors.push(`Task "${task.name}"의 trigger가 비어있습니다`)
        continue
      }

      if (task.trigger !== '_run_' && !nameSet.has(task.trigger)) {
        errors.push(`Task "${task.name}"의 trigger "${task.trigger}"를 찾을 수 없습니다`)
      }

      // 자기 자신을 trigger로 설정하는 경우
      if (task.trigger === task.name) {
        errors.push(`Task "${task.name}"가 자기 자신을 trigger로 설정했습니다`)
      }
    }

    // 5. DAG 생성 및 순환 참조 검증
    if (errors.length === 0) {
      try {
        const dag = DAG.fromPipeline(pipeline)

        if (dag.hasCycle()) {
          errors.push('순환 참조가 감지되었습니다. Pipeline은 DAG 구조여야 합니다')
        }

        // 6. 도달 불가능한 노드 검증
        const unreachable = dag.getUnreachableNodes()
        if (unreachable.length > 0) {
          const names = unreachable.map(n => n.name).join(', ')
          errors.push(`Root에서 도달할 수 없는 Task: ${names}`)
        }

        // 7. 고립된 노드 경고 (부모도 자식도 없는 노드)
        const isolated = pipeline.tasks.filter(task => {
          const node = dag.getNode(task.name)
          if (!node) return false
          return task.trigger !== '_run_' &&
                 node.parents.length === 0 &&
                 node.children.length === 0
        })

        if (isolated.length > 0) {
          const names = isolated.map(t => t.name).join(', ')
          warnings.push(`고립된 Task (연결되지 않음): ${names}`)
        }

      } catch (error) {
        errors.push(`DAG 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Task 추가 가능 여부 검증
   */
  canAddTask(pipeline: Pipeline, newTask: PipelineTask): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 이름 중복 검사
    if (pipeline.tasks.some(t => t.name === newTask.name)) {
      errors.push(`이미 존재하는 Task 이름: ${newTask.name}`)
    }

    // Trigger 유효성
    if (newTask.trigger !== '_run_') {
      const triggerExists = pipeline.tasks.some(t => t.name === newTask.trigger)
      if (!triggerExists) {
        errors.push(`Trigger "${newTask.trigger}"를 찾을 수 없습니다`)
      }
    } else {
      // _run_ trigger가 이미 있는지 확인
      if (pipeline.tasks.some(t => t.trigger === '_run_')) {
        errors.push('진입점은 하나만 가능합니다')
      }
    }

    // 추가 후 순환 참조가 생기는지 확인
    const testPipeline: Pipeline = {
      ...pipeline,
      tasks: [...pipeline.tasks, newTask]
    }

    try {
      const dag = DAG.fromPipeline(testPipeline)
      if (dag.hasCycle()) {
        errors.push('이 Task를 추가하면 순환 참조가 발생합니다')
      }
    } catch (error) {
      errors.push('Task 추가 검증 실패')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Task 제거 가능 여부 검증
   */
  canRemoveTask(pipeline: Pipeline, taskName: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 존재 여부 확인
    const task = pipeline.tasks.find(t => t.name === taskName)
    if (!task) {
      errors.push(`Task "${taskName}"를 찾을 수 없습니다`)
      return { valid: false, errors, warnings }
    }

    // 이 Task를 trigger로 하는 다른 Task들 찾기
    const dependents = pipeline.tasks.filter(t => t.trigger === taskName)
    if (dependents.length > 0) {
      const names = dependents.map(t => t.name).join(', ')
      warnings.push(`이 Task를 제거하면 다음 Task들이 고립됩니다: ${names}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Trigger 변경 가능 여부 검증
   */
  canChangeTrigger(
    pipeline: Pipeline,
    taskName: string,
    newTrigger: string
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Task 존재 확인
    const taskIndex = pipeline.tasks.findIndex(t => t.name === taskName)
    if (taskIndex === -1) {
      errors.push(`Task "${taskName}"를 찾을 수 없습니다`)
      return { valid: false, errors, warnings }
    }

    // 새 trigger 유효성
    if (newTrigger !== '_run_' && !pipeline.tasks.some(t => t.name === newTrigger)) {
      errors.push(`Trigger "${newTrigger}"를 찾을 수 없습니다`)
      return { valid: false, errors, warnings }
    }

    // 자기 자신을 trigger로 설정하는지
    if (newTrigger === taskName) {
      errors.push('자기 자신을 trigger로 설정할 수 없습니다')
      return { valid: false, errors, warnings }
    }

    // 변경 후 순환 참조 확인
    const testPipeline: Pipeline = {
      ...pipeline,
      tasks: pipeline.tasks.map((t, i) =>
        i === taskIndex ? { ...t, trigger: newTrigger } : t
      )
    }

    try {
      const dag = DAG.fromPipeline(testPipeline)
      if (dag.hasCycle()) {
        errors.push('Trigger를 변경하면 순환 참조가 발생합니다')
      }
    } catch (error) {
      errors.push('Trigger 변경 검증 실패')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}
