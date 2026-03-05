/**
 * Pipeline 검증 시스템
 */

import { Pipeline, PipelineTask, ValidationResult } from './types'
import { PipelineTree } from './dag'

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

      if (task.trigger !== '_run_' && task.trigger !== '_final_' && !nameSet.has(task.trigger)) {
        errors.push(`Task "${task.name}"의 trigger "${task.trigger}"를 찾을 수 없습니다`)
      }

      // 자기 자신을 trigger로 설정하는 경우
      if (task.trigger === task.name) {
        errors.push(`Task "${task.name}"가 자기 자신을 trigger로 설정했습니다`)
      }
    }

    // 5. 트리 생성 및 순환 참조 검증 (phase별 분리)
    if (errors.length === 0) {
      const phases: ('process' | 'final')[] = ['process']
      const hasFinal = pipeline.tasks.some(t => t.phase === 'final')
      if (hasFinal) phases.push('final')

      for (const phase of phases) {
        const phaseLabel = phase === 'process' ? 'Process' : 'Final'
        try {
          const tree = PipelineTree.fromPipeline(pipeline, phase)

          if (tree.hasCycle()) {
            errors.push(`${phaseLabel} 구간에서 순환 참조가 감지되었습니다`)
          }

          // 6. 도달 불가능한 노드 검증
          const unreachable = tree.getUnreachableNodes()
          if (unreachable.length > 0) {
            const names = unreachable.map(n => n.name).join(', ')
            errors.push(`${phaseLabel} 구간에서 Root에서 도달할 수 없는 Task: ${names}`)
          }

          // 7. 고립된 노드 경고 (부모도 자식도 없는 노드)
          const rootTrigger = phase === 'final' ? '_final_' : '_run_'
          const phaseTasks = phase === 'process'
            ? pipeline.tasks.filter(t => t.phase !== 'final')
            : pipeline.tasks.filter(t => t.phase === 'final')

          const isolated = phaseTasks.filter(task => {
            const node = tree.getNode(task.name)
            if (!node) return false
            return task.trigger !== rootTrigger &&
                   node.parent === null &&
                   node.children.length === 0
          })

          if (isolated.length > 0) {
            const names = isolated.map(t => t.name).join(', ')
            warnings.push(`${phaseLabel} 구간에 고립된 Task (연결되지 않음): ${names}`)
          }

        } catch (error) {
          errors.push(`${phaseLabel} 트리 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // 8. '_final_' trigger 검증: final phase task만 '_final_' trigger를 가질 수 있음
    for (const task of pipeline.tasks) {
      if (task.trigger === '_final_' && task.phase !== 'final') {
        errors.push(`Task "${task.name}"는 phase가 'final'이 아닌데 "_final_" trigger를 사용합니다. "_final_" trigger는 phase가 'final'인 Task만 사용할 수 있습니다`)
      }
    }

    // 9. '_run_' trigger 검증: process phase(또는 phase 미지정) task만 '_run_' trigger를 가질 수 있음
    for (const task of pipeline.tasks) {
      if (task.trigger === '_run_' && task.phase === 'final') {
        errors.push(`Task "${task.name}"는 phase가 'final'인데 "_run_" trigger를 사용합니다. "_run_" trigger는 process phase(또는 phase 미지정) Task만 사용할 수 있습니다`)
      }
    }

    // 10. 'result_save' Task는 자식 노드를 가질 수 없음 (터미널 노드)
    const resultSaveNames = new Set(
      pipeline.tasks.filter(t => t.category === 'result_save').map(t => t.name)
    )
    for (const task of pipeline.tasks) {
      if (resultSaveNames.has(task.trigger)) {
        errors.push(`Task "${task.name}"의 trigger "${task.trigger}"는 'result_save' 카테고리 Task입니다. result_save Task는 터미널 노드로 자식을 가질 수 없습니다`)
      }
    }

    // 11. phase 간 trigger 참조 검증: 같은 phase 내에서만 trigger 참조 가능
    // (단, '_run_'은 process phase 루트, '_final_'은 final phase 루트이므로 제외)
    const taskPhaseMap = new Map<string, 'process' | 'final'>()
    for (const task of pipeline.tasks) {
      taskPhaseMap.set(task.name, task.phase || 'process')
    }

    for (const task of pipeline.tasks) {
      if (task.trigger === '_run_' || task.trigger === '_final_') continue

      const taskPhase = task.phase || 'process'
      const triggerPhase = taskPhaseMap.get(task.trigger)

      if (triggerPhase !== undefined && triggerPhase !== taskPhase) {
        errors.push(`Task "${task.name}" (phase: '${taskPhase}')가 다른 phase의 Task "${task.trigger}" (phase: '${triggerPhase}')를 trigger로 참조합니다. phase 간 trigger 참조는 허용되지 않습니다`)
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
      const tree = PipelineTree.fromPipeline(testPipeline)
      if (tree.hasCycle()) {
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
      const tree = PipelineTree.fromPipeline(testPipeline)
      if (tree.hasCycle()) {
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
