/**
 * Pipeline 시스템 테스트
 */

import { Pipeline, PipelineTask } from './types'
import { DAG } from './dag'
import { PipelineValidator } from './validator'

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
      { taskId: 't1', name: 'crawl', trigger: '_run_' },
      { taskId: 't2', name: 'filter', trigger: 'crawl' },
      { taskId: 't3', name: 'screenshot', trigger: 'filter' }
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
      { taskId: 't1', name: 'crawl', trigger: '_run_' },
      { taskId: 't2', name: 'screenshot', trigger: 'crawl' },
      { taskId: 't3', name: 'scrape', trigger: 'crawl' },
      { taskId: 't4', name: 'pdf', trigger: 'crawl' }
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
      { taskId: 't1', name: 'main_crawl', trigger: '_run_' },
      { taskId: 't2', name: 'filter_products', trigger: 'main_crawl' },
      { taskId: 't3', name: 'filter_blogs', trigger: 'main_crawl' },
      { taskId: 't4', name: 'product_screenshot', trigger: 'filter_products' },
      { taskId: 't5', name: 'product_data', trigger: 'filter_products' },
      { taskId: 't6', name: 'blog_text', trigger: 'filter_blogs' }
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
      { taskId: 't1', name: 'a', trigger: '_run_' },
      { taskId: 't2', name: 'b', trigger: 'a' },
      { taskId: 't3', name: 'c', trigger: 'b' },
      { taskId: 't4', name: 'd', trigger: 'c' },
      { taskId: 't5', name: 'e', trigger: 'd' },
      { taskId: 't6', name: 'f', trigger: 'e' },
      { taskId: 't7', name: 'g', trigger: 'b' },  // 분기
      { taskId: 't8', name: 'h', trigger: 'g' },
      // 순환: h → c
      { taskId: 't9', name: 'cycle', trigger: 'h', config: '{"target": "c"}' }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  // 임시로 순환 만들기 (실제로는 이런 구조가 되면 안 됨)
  pipeline.tasks[8].trigger = 'h'
  pipeline.tasks.push({ taskId: 't10', name: 'back_to_b', trigger: 'cycle' })
  pipeline.tasks[pipeline.tasks.length - 1].trigger = 'b'  // b → ... → cycle → b (순환)

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
      { taskId: 't1', name: 'a', trigger: 'b' },
      { taskId: 't2', name: 'b', trigger: 'a' }
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
      { taskId: 't1', name: 'task', trigger: '_run_' },
      { taskId: 't2', name: 'task', trigger: 'task' }
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
      { taskId: 't1', name: 'a', trigger: '_run_' },
      { taskId: 't2', name: 'b', trigger: 'nonexistent' }
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
      { taskId: 't1', name: 'root', trigger: '_run_' },
      { taskId: 't2', name: 'a', trigger: 'root' },
      { taskId: 't3', name: 'b', trigger: 'root' },
      { taskId: 't4', name: 'c', trigger: 'a' },
      { taskId: 't5', name: 'd', trigger: 'a' },
      { taskId: 't6', name: 'e', trigger: 'b' }
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
