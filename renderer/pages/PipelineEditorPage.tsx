import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Stack,
  AppBar,
  Toolbar,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { Pipeline, PipelineTask } from '../types'
import { pipelineService } from '../services/pipelineService'
import TaskNodeComponent from '../components/pipeline/TaskNode'
import type { TaskNodeData } from '../components/pipeline/TaskNode'
import TaskPropertyPanel from '../components/pipeline/TaskPropertyPanel'
import type { TaskPropertyData } from '../components/pipeline/TaskPropertyPanel'

// Zod 스키마
const pipelineInfoSchema = z.object({
  name: z.string()
    .min(1, '파이프라인 이름을 입력해주세요')
    .max(100, '이름은 100자 이하여야 합니다'),
  description: z.string().max(500, '설명은 500자 이하여야 합니다').optional()
})

type PipelineInfoFormData = z.infer<typeof pipelineInfoSchema>

interface PipelineEditorPageProps {
  pipelineId: string | null
  onClose: () => void
}

// Final 구간의 루트 노드 생성 헬퍼
function createFinalRootNode(
  onAddChild: (id: string) => void,
  onDelete: (id: string) => void,
  onSelect: (id: string) => void
): Node {
  return {
    id: 'final-root',
    type: 'taskNode',
    position: { x: 400, y: 50 },
    data: {
      nodeId: 'final-root',
      taskName: '_final_',
      isRoot: true,
      isFinalRoot: true,
      isConfigured: true,
      onAddChild,
      onDelete,
      onSelect
    }
  }
}

// Process 구간의 루트 노드 생성 헬퍼
function createProcessRootNode(
  onAddChild: (id: string) => void,
  onDelete: (id: string) => void,
  onSelect: (id: string) => void
): Node {
  return {
    id: 'root',
    type: 'taskNode',
    position: { x: 400, y: 50 },
    data: {
      nodeId: 'root',
      taskName: '_run_',
      taskCategory: 'page_navigation',
      isRoot: true,
      isConfigured: true,
      onAddChild,
      onDelete,
      onSelect
    }
  }
}

export default function PipelineEditorPage({ pipelineId, onClose }: PipelineEditorPageProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)

  // React Hook Form - 파이프라인 정보
  const { register: registerInfo, watch: watchInfo, setValue: setValueInfo, formState: { errors: errorsInfo } } = useForm<PipelineInfoFormData>({
    resolver: zodResolver(pipelineInfoSchema),
    defaultValues: { name: '', description: '' }
  })

  const pipelineName = watchInfo('name')
  const pipelineDesc = watchInfo('description')

  const nodeTypes: NodeTypes = useMemo(() => ({
    taskNode: TaskNodeComponent
  }), [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const nodeCounterRef = useRef(0)

  // --- Process/Final 구간 토글 ---
  const [editorPhase, setEditorPhase] = useState<'process' | 'final'>('process')

  // 각 phase의 노드/엣지를 별도 ref에 보관
  const processNodesRef = useRef<Node[]>([])
  const processEdgesRef = useRef<Edge[]>([])
  const finalNodesRef = useRef<Node[]>([])
  const finalEdgesRef = useRef<Edge[]>([])

  // 우측 패널: 선택된 노드
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // 파이프라인 로드 또는 초기화
  useEffect(() => {
    if (pipelineId) {
      loadPipeline()
    } else {
      initializeNodes()
    }
  }, [pipelineId])

  const loadPipeline = async () => {
    if (!pipelineId) {
      setValueInfo('name', '')
      setValueInfo('description', '')
      return
    }

    try {
      const data = await pipelineService.get(pipelineId)
      if (data) {
        setPipeline(data)
        setValueInfo('name', data.name)
        setValueInfo('description', data.description || '')
        loadNodesFromPipeline(data)
      }
    } catch (err) {
      console.error('파이프라인 로드 실패:', err)
      initializeNodes()
    }
  }

  // tasks 배열에서 특정 phase의 노드/엣지를 생성하는 헬퍼
  const buildNodesFromTasks = (
    tasks: PipelineTask[],
    rootNode: Node,
    rootTriggerName: string
  ): { nodes: Node[], edges: Edge[], counter: number } => {
    const newNodes: Node[] = [rootNode]
    const newEdges: Edge[] = []

    const childrenByParent = new Map<string, PipelineTask[]>()
    tasks.forEach(task => {
      const parent = task.trigger
      if (!childrenByParent.has(parent)) {
        childrenByParent.set(parent, [])
      }
      childrenByParent.get(parent)!.push(task)
    })

    const nodeByName = new Map<string, Node>()
    nodeByName.set(rootTriggerName, rootNode)

    let counter = 0
    const layoutNode = (parentName: string, parentNode: Node) => {
      const children = childrenByParent.get(parentName) || []

      children.forEach((child, index) => {
        const nodeId = `node-${counter++}`

        const childNode: Node = {
          id: nodeId,
          type: 'taskNode',
          position: {
            x: parentNode.position.x + index * 170,
            y: parentNode.position.y + 80
          },
          data: {
            nodeId,
            taskName: child.name,
            taskCategory: child.category,
            taskConfig: child.taskConfig,
            isRoot: false,
            isConfigured: !!child.category,
            onAddChild: handleAddChild,
            onDelete: handleDeleteNode,
            onSelect: handleSelectNode
          }
        }

        newNodes.push(childNode)
        nodeByName.set(child.name, childNode)

        newEdges.push({
          id: `edge-${parentNode.id}-${nodeId}`,
          source: parentNode.id,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed }
        })

        layoutNode(child.name, childNode)
      })
    }

    layoutNode(rootTriggerName, rootNode)

    return { nodes: newNodes, edges: newEdges, counter }
  }

  const loadNodesFromPipeline = (pipelineData: Pipeline) => {
    // process tasks: phase가 'final'이 아닌 것 (기본값 포함)
    const processTasks = pipelineData.tasks.filter(t => t.phase !== 'final')
    // final tasks: phase가 'final'인 것
    const finalTasks = pipelineData.tasks.filter(t => t.phase === 'final')

    // Process 구간 빌드
    const processRoot = createProcessRootNode(handleAddChild, handleDeleteNode, handleSelectNode)
    const processResult = buildNodesFromTasks(processTasks, processRoot, '_run_')

    // Final 구간 빌드
    const finalRoot = createFinalRootNode(handleAddChild, handleDeleteNode, handleSelectNode)
    const finalResult = buildNodesFromTasks(finalTasks, finalRoot, '_final_')

    // ref에 저장
    processNodesRef.current = processResult.nodes
    processEdgesRef.current = processResult.edges
    finalNodesRef.current = finalResult.nodes
    finalEdgesRef.current = finalResult.edges

    // 현재 phase에 따라 화면에 표시
    const maxCounter = Math.max(processResult.counter, finalResult.counter)
    nodeCounterRef.current = maxCounter

    if (editorPhase === 'process') {
      setNodes(processResult.nodes)
      setEdges(processResult.edges)
    } else {
      setNodes(finalResult.nodes)
      setEdges(finalResult.edges)
    }
  }

  const initializeNodes = () => {
    const processRoot = createProcessRootNode(handleAddChild, handleDeleteNode, handleSelectNode)
    const finalRoot = createFinalRootNode(handleAddChild, handleDeleteNode, handleSelectNode)

    processNodesRef.current = [processRoot]
    processEdgesRef.current = []
    finalNodesRef.current = [finalRoot]
    finalEdgesRef.current = []

    // 기본은 process phase
    setNodes([processRoot])
    setEdges([])
  }

  // --- Phase 전환 핸들러 ---

  const handlePhaseChange = useCallback((_event: React.MouseEvent<HTMLElement>, newPhase: 'process' | 'final' | null) => {
    if (!newPhase || newPhase === editorPhase) return

    // 현재 phase의 노드/엣지를 ref에 저장
    setNodes(currentNodes => {
      setEdges(currentEdges => {
        if (editorPhase === 'process') {
          processNodesRef.current = currentNodes
          processEdgesRef.current = currentEdges
        } else {
          finalNodesRef.current = currentNodes
          finalEdgesRef.current = currentEdges
        }
        return currentEdges
      })
      return currentNodes
    })

    // 선택 해제
    setSelectedNodeId(null)

    // 다음 phase의 노드/엣지로 교체 (약간의 딜레이로 상태 저장 완료 보장)
    setTimeout(() => {
      if (newPhase === 'process') {
        setNodes(processNodesRef.current)
        setEdges(processEdgesRef.current)
      } else {
        setNodes(finalNodesRef.current)
        setEdges(finalEdgesRef.current)
      }
      setEditorPhase(newPhase)
    }, 0)
  }, [editorPhase])

  // --- 핸들러 ---

  const handleAddChild = useCallback((parentId: string) => {
    // setEdges/setNodes 함수형 업데이트로만 상태 접근 → stale closure 방지
    setEdges(currentEdges => {
      // _run_ 루트에만 자식 1개 제한 (final-root에는 제한 없음)
      if (parentId === 'root') {
        const rootChildren = currentEdges.filter(e => e.source === 'root')
        if (rootChildren.length > 0) {
          alert('_run_에는 하나의 태스크만 연결할 수 있습니다.')
          return currentEdges
        }
      }

      const counter = nodeCounterRef.current
      const newNodeId = `node-${counter}`
      nodeCounterRef.current = counter + 1

      const childCount = currentEdges.filter(e => e.source === parentId).length

      setNodes(currentNodes => {
        const parentNode = currentNodes.find(n => n.id === parentId)
        if (!parentNode) return currentNodes

        const newNode: Node = {
          id: newNodeId,
          type: 'taskNode',
          position: {
            x: parentNode.position.x + childCount * 170,
            y: parentNode.position.y + 80
          },
          data: {
            nodeId: newNodeId,
            taskName: `task_${counter}`,
            isRoot: false,
            isConfigured: false,
            onAddChild: handleAddChild,
            onDelete: handleDeleteNode,
            onSelect: handleSelectNode
          } as TaskNodeData
        }

        return [...currentNodes, newNode]
      })

      setSelectedNodeId(newNodeId)

      const newEdge: Edge = {
        id: `edge-${parentId}-${newNodeId}`,
        source: parentId,
        target: newNodeId,
        type: 'smoothstep',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed }
      }

      return [...currentEdges, newEdge]
    })
  }, [])

  const handleDeleteNode = useCallback((nodeId: string) => {
    setEdges(currentEdges => {
      const visited = new Set<string>()
      const findDescendants = (id: string): string[] => {
        if (visited.has(id)) return []
        visited.add(id)
        const children = currentEdges.filter(e => e.source === id).map(e => e.target)
        return [id, ...children.flatMap(findDescendants)]
      }

      const toDelete = findDescendants(nodeId)
      setNodes(nds => nds.filter(n => !toDelete.includes(n.id)))
      setSelectedNodeId(prev => prev && toDelete.includes(prev) ? null : prev)

      return currentEdges.filter(e => !toDelete.includes(e.source) && !toDelete.includes(e.target))
    })
  }, [])

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(prev => {
      // 노드 data에 isSelected 반영
      setNodes(nds => nds.map(n => ({
        ...n,
        data: { ...n.data, isSelected: n.id === nodeId }
      })))
      return nodeId
    })
  }, [])

  const handlePaneClick = useCallback(() => {
    // 캔버스 빈 곳 클릭 시 속성 패널을 닫지 않음 (X 버튼으로만 닫기)
  }, [])

  const handleUpdateNode = useCallback((updates: Partial<TaskPropertyData>) => {
    if (!selectedNodeId) return

    setNodes(nds => nds.map(node => {
      if (node.id !== selectedNodeId) return node

      const newData = { ...node.data }
      if (updates.taskName !== undefined) newData.taskName = updates.taskName
      if (updates.taskCategory !== undefined) newData.taskCategory = updates.taskCategory
      if (updates.taskConfig !== undefined) newData.taskConfig = updates.taskConfig

      newData.isConfigured = !!(newData.taskCategory && newData.taskName?.trim())

      return { ...node, data: newData }
    }))
  }, [selectedNodeId])

  // --- 두 phase의 노드/엣지에서 tasks 배열을 추출하는 헬퍼 ---

  const extractTasksFromPhase = (
    phaseNodes: Node[],
    phaseEdges: Edge[],
    phase: 'process' | 'final'
  ): PipelineTask[] => {
    const tasks: PipelineTask[] = []
    const nodeById = new Map<string, Node>()
    phaseNodes.forEach(n => nodeById.set(n.id, n))

    for (const edge of phaseEdges) {
      const sourceNode = nodeById.get(edge.source)
      const targetNode = nodeById.get(edge.target)
      if (!sourceNode || !targetNode) continue
      if (!targetNode.data.isConfigured) continue

      const targetData = targetNode.data as TaskNodeData
      if (!targetData.taskCategory) continue

      tasks.push({
        name: targetData.taskName,
        trigger: (sourceNode.data as TaskNodeData).taskName,
        category: targetData.taskCategory,
        taskConfig: targetData.taskConfig || {},
        phase
      })
    }

    return tasks
  }

  // 현재 phase와 ref에서 양쪽 노드/엣지를 가져오는 헬퍼
  const getAllPhaseData = () => {
    let processNodes: Node[], processEdges: Edge[]
    let finalNodes: Node[], finalEdges: Edge[]

    if (editorPhase === 'process') {
      processNodes = nodes
      processEdges = edges
      finalNodes = finalNodesRef.current
      finalEdges = finalEdgesRef.current
    } else {
      processNodes = processNodesRef.current
      processEdges = processEdgesRef.current
      finalNodes = nodes
      finalEdges = edges
    }

    return { processNodes, processEdges, finalNodes, finalEdges }
  }

  // --- 저장 ---

  const handleSave = async () => {
    if (!pipelineName || !pipelineName.trim()) {
      alert('파이프라인 이름을 입력해주세요.')
      return
    }

    const { processNodes, processEdges, finalNodes, finalEdges } = getAllPhaseData()

    const allNonRootNodes = [
      ...processNodes.filter(n => !n.data.isRoot),
      ...finalNodes.filter(n => !n.data.isRoot)
    ]
    const unconfiguredNodes = allNonRootNodes.filter(n => !n.data.isConfigured)

    if (unconfiguredNodes.length > 0) {
      const ok = confirm(
        `미설정 노드가 ${unconfiguredNodes.length}개 있습니다. 미설정 노드는 저장에서 제외됩니다. 계속하시겠습니까?`
      )
      if (!ok) return
    }

    try {
      const processTasks = extractTasksFromPhase(processNodes, processEdges, 'process')
      const finalTasks = extractTasksFromPhase(finalNodes, finalEdges, 'final')
      const tasks = [...processTasks, ...finalTasks]

      if (pipelineId) {
        const updatedPipeline: Pipeline = {
          ...pipeline!,
          name: pipelineName,
          description: pipelineDesc,
          tasks
        }
        const result = await pipelineService.save(updatedPipeline)
        if (result.success) {
          alert('파이프라인이 저장되었습니다.')
          onClose()
        } else {
          alert(`저장 실패: ${result.error}`)
        }
      } else {
        const newPipeline = await pipelineService.create(pipelineName, pipelineDesc)
        if (newPipeline) {
          const updatedPipeline: Pipeline = { ...newPipeline, tasks }
          const result = await pipelineService.save(updatedPipeline)
          if (result.success) {
            alert('파이프라인이 생성되었습니다.')
            onClose()
          } else {
            alert(`저장 실패: ${result.error}`)
          }
        }
      }
    } catch (err: unknown) {
      console.error('파이프라인 저장 실패:', err)
      alert(`파이프라인 저장 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    }
  }

  // --- 선택 노드의 부모 정보 계산 ---

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null
  const parentEdge = selectedNodeId ? edges.find(e => e.target === selectedNodeId) : null
  const parentNode = parentEdge ? nodes.find(n => n.id === parentEdge.source) : null
  const parentData = parentNode?.data as TaskNodeData | undefined

  // --- JSON 뷰어용 파이프라인 데이터 구축 ---

  const buildPipelineJson = useCallback(() => {
    const { processNodes, processEdges, finalNodes, finalEdges } = getAllPhaseData()

    const processTasks = extractTasksFromPhase(processNodes, processEdges, 'process')
    const finalTasks = extractTasksFromPhase(finalNodes, finalEdges, 'final')

    return {
      name: pipelineName || '',
      description: pipelineDesc || '',
      tasks: [...processTasks, ...finalTasks]
    }
  }, [nodes, edges, pipelineName, pipelineDesc, editorPhase])

  return (
    <Box sx={{ height: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <TextField
              {...registerInfo('name')}
              placeholder="파이프라인 이름"
              variant="standard"
              sx={{ minWidth: 300, mb: 0.5 }}
              InputProps={{ style: { fontSize: '18px', fontWeight: 600 } }}
              error={!!errorsInfo.name}
              helperText={errorsInfo.name?.message}
            />
            <TextField
              {...registerInfo('description')}
              placeholder="설명 (선택사항)"
              variant="standard"
              fullWidth
              sx={{ maxWidth: 500 }}
              InputProps={{ style: { fontSize: '14px' } }}
              error={!!errorsInfo.description}
              helperText={errorsInfo.description?.message}
            />
          </Box>
          <ToggleButtonGroup
            value={editorPhase}
            exclusive
            onChange={handlePhaseChange}
            size="small"
            sx={{ mr: 2 }}
          >
            <ToggleButton value="process" sx={{ textTransform: 'none', px: 2 }}>
              Process
            </ToggleButton>
            <ToggleButton value="final" sx={{ textTransform: 'none', px: 2 }}>
              Final
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!pipelineName?.trim()}
          >
            저장
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: React Flow Canvas */}
        <Box sx={{ flex: 1, bgcolor: 'background.default', position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            onPaneClick={handlePaneClick}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            proOptions={{ hideAttribution: true }}
          />
        </Box>

        {/* 노드 속성 패널: 선택 시에만 캔버스 우측에 표시 */}
        {selectedNode && (
          <Box sx={{
            width: 300,
            borderLeft: 1,
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <TaskPropertyPanel
              data={{
                taskName: (selectedNode.data as TaskNodeData).taskName,
                taskCategory: (selectedNode.data as TaskNodeData).taskCategory,
                taskConfig: (selectedNode.data as TaskNodeData).taskConfig
              }}
              parentCategory={parentData?.taskCategory}
              isParentRoot={parentData?.isRoot}
              isReadOnly={!!(selectedNode.data as TaskNodeData).isRoot}
              onUpdate={handleUpdateNode}
              onClose={() => {
                setSelectedNodeId(null)
                setNodes(nds => nds.map(n => ({
                  ...n,
                  data: { ...n.data, isSelected: false }
                })))
              }}
            />
          </Box>
        )}

        {/* 우측: JSON 뷰어 (항상 표시) */}
        <Box sx={{
          width: 280,
          borderLeft: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.default'
        }}>
          <Box sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pipeline JSON
            </Typography>
          </Box>
          <Box sx={{
            flex: 1,
            overflow: 'auto',
            p: 1.5,
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: 1.5,
            color: 'text.primary',
            bgcolor: 'background.default',
            whiteSpace: 'pre',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.700', borderRadius: 3 },
          }}>
            {JSON.stringify(buildPipelineJson(), null, 2)}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
