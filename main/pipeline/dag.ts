/**
 * DAG (Directed Acyclic Graph) 자료구조
 */

import { Pipeline, PipelineTask, DAGNode, DAGGraph } from './types'

export class DAG {
  private nodes: Map<string, DAGNode>
  private root: DAGNode | null

  constructor() {
    this.nodes = new Map()
    this.root = null
  }

  /**
   * Pipeline으로부터 DAG 생성
   */
  static fromPipeline(pipeline: Pipeline): DAG {
    const dag = new DAG()

    // 1. 모든 노드 생성
    for (const task of pipeline.tasks) {
      const node: DAGNode = {
        name: task.name,
        taskId: task.taskId,
        trigger: task.trigger,
        config: task.config ? JSON.parse(task.config) : undefined,
        children: [],
        parents: []
      }
      dag.nodes.set(task.name, node)

      // root 노드 찾기
      if (task.trigger === '_run_') {
        dag.root = node
      }
    }

    // 2. 간선 연결 (부모-자식 관계)
    for (const task of pipeline.tasks) {
      if (task.trigger === '_run_') continue

      const childNode = dag.nodes.get(task.name)
      const parentNode = dag.nodes.get(task.trigger)

      if (childNode && parentNode) {
        parentNode.children.push(childNode)
        childNode.parents.push(parentNode)
      }
    }

    return dag
  }

  /**
   * 루트 노드 반환
   */
  getRoot(): DAGNode | null {
    return this.root
  }

  /**
   * 특정 노드 반환
   */
  getNode(name: string): DAGNode | null {
    return this.nodes.get(name) || null
  }

  /**
   * 모든 노드 반환
   */
  getAllNodes(): DAGNode[] {
    return Array.from(this.nodes.values())
  }

  /**
   * 리프 노드들 반환 (자식이 없는 노드들)
   */
  getLeafNodes(): DAGNode[] {
    return this.getAllNodes().filter(node => node.children.length === 0)
  }

  /**
   * 위상 정렬 (Topological Sort)
   * DFS 기반으로 실행 순서 결정
   */
  topologicalSort(): DAGNode[] {
    const visited = new Set<string>()
    const result: DAGNode[] = []

    const dfs = (node: DAGNode) => {
      if (visited.has(node.name)) return

      visited.add(node.name)

      // 자식 노드들 먼저 방문
      for (const child of node.children) {
        dfs(child)
      }

      // 후위 순회로 결과에 추가
      result.push(node)
    }

    if (this.root) {
      dfs(this.root)
    }

    // 역순으로 반환 (root가 먼저 오도록)
    return result.reverse()
  }

  /**
   * 순환 참조 검사
   */
  hasCycle(): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (node: DAGNode): boolean => {
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
  getReachableNodes(startNode: DAGNode): Set<string> {
    const reachable = new Set<string>()
    const queue: DAGNode[] = [startNode]

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
  getUnreachableNodes(): DAGNode[] {
    if (!this.root) {
      return this.getAllNodes()
    }

    const reachable = this.getReachableNodes(this.root)
    return this.getAllNodes().filter(node => !reachable.has(node.name))
  }

  /**
   * 특정 노드의 모든 조상 찾기
   */
  getAncestors(node: DAGNode): Set<string> {
    const ancestors = new Set<string>()
    const queue: DAGNode[] = [...node.parents]

    while (queue.length > 0) {
      const parent = queue.shift()!

      if (ancestors.has(parent.name)) continue
      ancestors.add(parent.name)

      for (const grandparent of parent.parents) {
        queue.push(grandparent)
      }
    }

    return ancestors
  }

  /**
   * 특정 노드의 모든 자손 찾기
   */
  getDescendants(node: DAGNode): Set<string> {
    const descendants = new Set<string>()
    const queue: DAGNode[] = [...node.children]

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
   * DAG를 시각화용 문자열로 변환
   */
  toString(): string {
    const lines: string[] = []
    const visited = new Set<string>()

    const print = (node: DAGNode, indent: number = 0) => {
      if (visited.has(node.name)) {
        lines.push('  '.repeat(indent) + `${node.name} (already visited)`)
        return
      }

      visited.add(node.name)
      lines.push('  '.repeat(indent) + `${node.name} [${node.taskId}]`)

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
   * DAG를 JSON으로 직렬화
   */
  toJSON(): DAGGraph {
    return {
      nodes: this.nodes,
      root: this.root
    }
  }
}
