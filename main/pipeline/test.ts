/**
 * Pipeline 시스템 테스트
 */

import { Pipeline, PipelineTask } from './types'
import { DAG } from './dag'
import { PipelineValidator } from './validator'

// 테스트 헬퍼: 간단한 PipelineTask 생성
function makeTask(
  name: string,
  trigger: string,
  category: PipelineTask['category'] = 'string_filter',
  taskConfig: Record<string, unknown> = {}
): PipelineTask {
  return { name, trigger, category, taskConfig }
}

/**
 * 테스트 실행
 */
export function runPipelineTests() {
  console.log('========== Pipeline System Tests ==========\n')

  testSimpleChain()
  testBranching()
  testComplexDAG()
  testCycleDetection()
  testValidation()
  testDAGOperations()

  console.log('\n========== All Tests Completed ==========')
}

/**
 * 테스트 1: 단순 체인
 */
function testSimpleChain() {
  console.log('Test 1: Simple Chain')

  const pipeline: Pipeline = {
    id: 'p1',
    name: 'Simple Chain',
    tasks: [
      makeTask('navigate', '_run_', 'page_navigation', { waitUntil: 'domcontentloaded', timeout: 30000 }),
      makeTask('extract', 'navigate', 'link_extraction', { includeHrefLinks: true }),
      makeTask('filter', 'extract', 'string_filter', { limit: 10 })
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const dag = DAG.fromPipeline(pipeline)
  const validator = new PipelineValidator()
  const result = validator.validate(pipeline)

  console.log('  DAG Structure:')
  console.log(dag.toString().split('\n').map(l => '    ' + l).join('\n'))
  console.log(`  Validation: ${result.valid ? '✅ PASS' : '❌ FAIL'}`)
  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.join(', ')}`)
  }
  console.log()
}

/**
 * 테스트 2: 분기 (병렬)
 */
function testBranching() {
  console.log('Test 2: Branching (Parallel)')

  const pipeline: Pipeline = {
    id: 'p2',
    name: 'Branching',
    tasks: [
      makeTask('navigate', '_run_', 'page_navigation', { waitUntil: 'load' }),
      makeTask('extract_links', 'navigate', 'link_extraction', { includeHrefLinks: true }),
      makeTask('extract_resources', 'navigate', 'link_extraction', { includeTextUrls: true }),
      makeTask('filter_links', 'extract_links', 'string_filter', { limit: 5 })
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const dag = DAG.fromPipeline(pipeline)
  const validator = new PipelineValidator()
  const result = validator.validate(pipeline)

  console.log('  DAG Structure:')
  console.log(dag.toString().split('\n').map(l => '    ' + l).join('\n'))
  console.log(`  Validation: ${result.valid ? '✅ PASS' : '❌ FAIL'}`)

  // 리프 노드 확인
  const leafNodes = dag.getLeafNodes()
  console.log(`  Leaf Nodes: ${leafNodes.map(n => n.name).join(', ')}`)
  console.log()
}

/**
 * 테스트 3: 복잡한 DAG
 */
function testComplexDAG() {
  console.log('Test 3: Complex DAG')

  const pipeline: Pipeline = {
    id: 'p3',
    name: 'Complex DAG',
    tasks: [
      makeTask('navigate', '_run_', 'page_navigation', { waitUntil: 'domcontentloaded' }),
      makeTask('extract_all', 'navigate', 'link_extraction', { includeHrefLinks: true, includeTextUrls: true }),
      makeTask('filter_products', 'extract_all', 'string_filter', { limit: -1 }),
      makeTask('filter_blogs', 'extract_all', 'string_filter', { limit: 20 }),
      makeTask('resource_imgs', 'filter_products', 'resource_extraction', { resourceTypes: ['image'] }),
      makeTask('resource_pdfs', 'filter_blogs', 'resource_extraction', { resourceTypes: ['pdf'] })
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const dag = DAG.fromPipeline(pipeline)
  const validator = new PipelineValidator()
  const result = validator.validate(pipeline)

  console.log('  DAG Structure:')
  console.log(dag.toString().split('\n').map(l => '    ' + l).join('\n'))
  console.log(`  Validation: ${result.valid ? '✅ PASS' : '❌ FAIL'}`)

  // 위상 정렬
  const sorted = dag.topologicalSort()
  console.log(`  Topological Order: ${sorted.map(n => n.name).join(' → ')}`)
  console.log()
}

/**
 * 테스트 4: 순환 참조 감지
 */
function testCycleDetection() {
  console.log('Test 4: Cycle Detection')

  const pipeline: Pipeline = {
    id: 'p4',
    name: 'Cyclic (Invalid)',
    tasks: [
      makeTask('a', '_run_', 'page_navigation'),
      makeTask('b', 'a', 'link_extraction'),
      makeTask('c', 'b', 'string_filter'),
      makeTask('d', 'c', 'string_filter'),
      makeTask('e', 'd', 'string_filter'),
      makeTask('f', 'e', 'string_filter'),
      makeTask('g', 'b', 'string_filter'),
      makeTask('h', 'g', 'string_filter'),
      makeTask('cycle', 'h', 'string_filter')
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  // 순환 만들기: back_to_b의 trigger를 'b'로 설정하여 b → ... → cycle → back_to_b → b 순환
  pipeline.tasks.push(makeTask('back_to_b', 'b', 'string_filter'))

  const dag = DAG.fromPipeline(pipeline)
  const validator = new PipelineValidator()
  const result = validator.validate(pipeline)
  const hasCycle = dag.hasCycle()

  console.log(`  Has Cycle: ${hasCycle ? '✅ Detected' : '❌ Not Detected'}`)
  console.log(`  Validation: ${result.valid ? '❌ PASS (should fail)' : '✅ FAIL (expected)'}`)
  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.join(', ')}`)
  }
  console.log()
}

/**
 * 테스트 5: 검증 시스템
 */
function testValidation() {
  console.log('Test 5: Validation System')

  const validator = new PipelineValidator()

  // 케이스 1: 진입점 없음
  console.log('  Case 1: No Entry Point')
  const p1: Pipeline = {
    id: 'p1',
    name: 'No Entry',
    tasks: [
      makeTask('a', 'b', 'string_filter'),
      makeTask('b', 'a', 'string_filter')
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  const r1 = validator.validate(p1)
  console.log(`    Result: ${r1.valid ? '❌ PASS' : '✅ FAIL (expected)'}`)
  console.log(`    Errors: ${r1.errors.join(', ')}`)

  // 케이스 2: 중복 이름
  console.log('\n  Case 2: Duplicate Names')
  const p2: Pipeline = {
    id: 'p2',
    name: 'Duplicate',
    tasks: [
      makeTask('task', '_run_', 'page_navigation'),
      makeTask('task', 'task', 'link_extraction')
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  const r2 = validator.validate(p2)
  console.log(`    Result: ${r2.valid ? '❌ PASS' : '✅ FAIL (expected)'}`)
  console.log(`    Errors: ${r2.errors.join(', ')}`)

  // 케이스 3: 존재하지 않는 trigger
  console.log('\n  Case 3: Invalid Trigger')
  const p3: Pipeline = {
    id: 'p3',
    name: 'Invalid Trigger',
    tasks: [
      makeTask('a', '_run_', 'page_navigation'),
      makeTask('b', 'nonexistent', 'link_extraction')
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  const r3 = validator.validate(p3)
  console.log(`    Result: ${r3.valid ? '❌ PASS' : '✅ FAIL (expected)'}`)
  console.log(`    Errors: ${r3.errors.join(', ')}`)

  console.log()
}

/**
 * 테스트 6: DAG 연산
 */
function testDAGOperations() {
  console.log('Test 6: DAG Operations')

  const pipeline: Pipeline = {
    id: 'p6',
    name: 'DAG Ops',
    tasks: [
      makeTask('root', '_run_', 'page_navigation'),
      makeTask('a', 'root', 'link_extraction'),
      makeTask('b', 'root', 'link_extraction'),
      makeTask('c', 'a', 'string_filter'),
      makeTask('d', 'a', 'resource_extraction', { resourceTypes: ['image'] }),
      makeTask('e', 'b', 'string_filter')
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const dag = DAG.fromPipeline(pipeline)

  // Ancestors
  const nodeC = dag.getNode('c')!
  const ancestors = dag.getAncestors(nodeC)
  console.log(`  Ancestors of 'c': ${Array.from(ancestors).join(', ')}`)

  // Descendants
  const nodeRoot = dag.getNode('root')!
  const descendants = dag.getDescendants(nodeRoot)
  console.log(`  Descendants of 'root': ${Array.from(descendants).join(', ')}`)

  // Reachable
  const reachable = dag.getReachableNodes(nodeRoot)
  console.log(`  Reachable from 'root': ${Array.from(reachable).join(', ')}`)

  console.log()
}

// 테스트 실행 (주석 처리 - 실제로는 별도 스크립트로 실행)
// runPipelineTests()
