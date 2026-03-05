/**
 * Pipeline Tree 자료구조
 * 각 노드는 부모가 최대 하나인 트리 구조
 */

import { Pipeline, PipelineTask, TreeNode, TreeGraph } from './types'

export class PipelineTree {
  private nodes: Map<string, TreeNode>
  private root: TreeNode | null

  constructor() {
    this.nodes = new Map()
    this.root = null
  }

  /**
   * Pipeline으로부터 Tree 생성
   * @param phase 지정 시 해당 phase의 task만 포함. 미지정 시 모든 task 포함 (하위호환)
   */
  static fromPipeline(pipeline: Pipeline, phase?: 'process' | 'final'): PipelineTree {
    const tree = new PipelineTree()

    // phase 필터링: 지정된 경우 해당 phase의 task만 처리
    const filteredTasks = phase === undefined
      ? pipeline.tasks
      : phase === 'process'
        ? pipeline.tasks.filter(t => t.phase !== 'final')
        : pipeline.tasks.filter(t => t.phase === 'final')

    // 루트 trigger: phase에 따라 결정
    const rootTrigger = phase === 'final' ? '_final_' : '_run_'

    // 1. 필터링된 노드 생성
    for (const task of filteredTasks) {
      const node: TreeNode = {
        name: task.name,
        category: task.category,
        taskConfig: task.taskConfig,
        trigger: task.trigger,
        taskId: task.taskId,
        phase: task.phase || 'process',
        children: [],
        parent: null
      }
      tree.nodes.set(task.name, node)

      // root 노드 찾기
      if (task.trigger === rootTrigger) {
        tree.root = node
      }
    }

    // 2. 간선 연결 (부모-자식 관계, 트리: 부모는 하나)
    for (const task of filteredTasks) {
      if (task.trigger === '_run_' || task.trigger === '_final_') continue

      const childNode = tree.nodes.get(task.name)
      const parentNode = tree.nodes.get(task.trigger)

      if (childNode && parentNode) {
        parentNode.children.push(childNode)
        childNode.parent = parentNode
      }
    }

    return tree
  }

  /**
   * 루트 노드 반환
   */
  getRoot(): TreeNode | null {
    return this.root
  }

  /**
   * 특정 노드 반환
   */
  getNode(name: string): TreeNode | null {
    return this.nodes.get(name) || null
  }

  /**
   * 모든 노드 반환
   */
  getAllNodes(): TreeNode[] {
    return Array.from(this.nodes.values())
  }

  /**
   * 리프 노드들 반환 (자식이 없는 노드들)
   */
  getLeafNodes(): TreeNode[] {
    return this.getAllNodes().filter(node => node.children.length === 0)
  }

  /**
   * 위상 정렬 (Topological Sort)
   * BFS 기반으로 레벨 순서 탐색 (트리이므로 단순 BFS가 위상 정렬)
   */
  topologicalSort(): TreeNode[] {
    if (!this.root) return []

    const result: TreeNode[] = []
    const queue: TreeNode[] = [this.root]

    while (queue.length > 0) {
      const node = queue.shift()!
      result.push(node)

      for (const child of node.children) {
        queue.push(child)
      }
    }

    return result
  }

  /**
   * 순환 참조 검사
   */
  hasCycle(): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (node: TreeNode): boolean => {
      visited.add(node.name)
      recursionStack.add(node.name)

      for (const child of node.children) {
        if (!visited.has(child.name)) {
          if (dfs(child)) return true
        } else if (recursionStack.has(child.name)) {
          return true  // 순환 발견!
        }
      }

      recursionStack.delete(node.name)
      return false
    }

    for (const node of this.nodes.values()) {
      if (!visited.has(node.name)) {
        if (dfs(node)) return true
      }
    }

    return false
  }

  /**
   * 특정 노드에서 도달 가능한 모든 노드 찾기 (BFS)
   */
  getReachableNodes(startNode: TreeNode): Set<string> {
    const reachable = new Set<string>()
    const queue: TreeNode[] = [startNode]

    while (queue.length > 0) {
      const node = queue.shift()!

      if (reachable.has(node.name)) continue
      reachable.add(node.name)

      for (const child of node.children) {
        queue.push(child)
      }
    }

    return reachable
  }

  /**
   * Root에서 도달 불가능한 노드들 찾기
   */
  getUnreachableNodes(): TreeNode[] {
    if (!this.root) {
      return this.getAllNodes()
    }

    const reachable = this.getReachableNodes(this.root)
    return this.getAllNodes().filter(node => !reachable.has(node.name))
  }

  /**
   * 특정 노드의 모든 조상 찾기 (트리: 루트까지 직선 경로)
   */
  getAncestors(node: TreeNode): Set<string> {
    const ancestors = new Set<string>()
    let current = node.parent

    while (current) {
      ancestors.add(current.name)
      current = current.parent
    }

    return ancestors
  }

  /**
   * 특정 노드의 모든 자손 찾기
   */
  getDescendants(node: TreeNode): Set<string> {
    const descendants = new Set<string>()
    const queue: TreeNode[] = [...node.children]

    while (queue.length > 0) {
      const child = queue.shift()!

      if (descendants.has(child.name)) continue
      descendants.add(child.name)

      for (const grandchild of child.children) {
        queue.push(grandchild)
      }
    }

    return descendants
  }

  /**
   * 트리를 시각화용 문자열로 변환
   */
  toString(): string {
    const lines: string[] = []
    const visited = new Set<string>()

    const print = (node: TreeNode, indent: number = 0) => {
      if (visited.has(node.name)) {
        lines.push('  '.repeat(indent) + `${node.name} (already visited)`)
        return
      }

      visited.add(node.name)
      lines.push('  '.repeat(indent) + `${node.name} [${node.category}]`)

      for (const child of node.children) {
        print(child, indent + 1)
      }
    }

    if (this.root) {
      print(this.root)
    } else {
      lines.push('(no root)')
    }

    return lines.join('\n')
  }

  /**
   * 트리를 JSON으로 직렬화
   */
  toJSON(): TreeGraph {
    return {
      nodes: this.nodes,
      root: this.root
    }
  }
}
