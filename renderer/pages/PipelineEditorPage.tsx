import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Toolbar
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
import type { Pipeline, PipelineTask, Filter } from '../types'
import { pipelineService } from '../services/pipelineService'
import { filterService } from '../services/filterService'
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
  const [nodeCounter, setNodeCounter] = useState(0)

  // 우측 패널: 선택된 노드
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filter[]>([])

  // Filter 목록 로드
  useEffect(() => {
    filterService.getAll()
      .then(setFilters)
      .catch(() => setFilters([]))
  }, [])

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

  const loadNodesFromPipeline = (pipelineData: Pipeline) => {
    const rootNode: Node = {
      id: 'root',
      type: 'taskNode',
      position: { x: 400, y: 50 },
      data: {
        nodeId: 'root',
        taskName: '_run_',
        isRoot: true,
        isConfigured: true,
        onAddChild: handleAddChild,
        onDelete: handleDeleteNode,
        onSelect: handleSelectNode
      }
    }

    const newNodes: Node[] = [rootNode]
    const newEdges: Edge[] = []

    // 부모별 자식 그룹
    const childrenByParent = new Map<string, PipelineTask[]>()
    pipelineData.tasks.forEach(task => {
      const parent = task.trigger
      if (!childrenByParent.has(parent)) {
        childrenByParent.set(parent, [])
      }
      childrenByParent.get(parent)!.push(task)
    })

    const nodeByName = new Map<string, Node>()
    nodeByName.set('_run_', rootNode)

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

    layoutNode('_run_', rootNode)

    setNodes(newNodes)
    setEdges(newEdges)
    setNodeCounter(counter)
  }

  const initializeNodes = () => {
    const rootNode: Node = {
      id: 'root',
      type: 'taskNode',
      position: { x: 400, y: 50 },
      data: {
        nodeId: 'root',
        taskName: '_run_',
        isRoot: true,
        isConfigured: true,
        onAddChild: handleAddChild,
        onDelete: handleDeleteNode,
        onSelect: handleSelectNode
      }
    }
    setNodes([rootNode])
    setEdges([])
  }

  // --- 핸들러 ---

  // nodeCounter를 ref로 관리하여 콜백이 안정적 참조 유지
  const nodeCounterRef = { current: nodeCounter }
  nodeCounterRef.current = nodeCounter

  const handleAddChild = useCallback((parentId: string) => {
    // setEdges/setNodes 함수형 업데이트로만 상태 접근 → stale closure 방지
    setEdges(currentEdges => {
      if (parentId === 'root') {
        const rootChildren = currentEdges.filter(e => e.source === 'root')
        if (rootChildren.length > 0) {
          alert('_run_에는 하나의 태스크만 연결할 수 있습니다.')
          return currentEdges
        }
      }

      const counter = nodeCounterRef.current
      const newNodeId = `node-${counter}`
      setNodeCounter(counter + 1)

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
      const findDescendants = (id: string): string[] => {
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
    setSelectedNodeId(null)
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, isSelected: false }
    })))
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

  // --- 저장 ---

  const handleSave = async () => {
    if (!pipelineName || !pipelineName.trim()) {
      alert('파이프라인 이름을 입력해주세요.')
      return
    }

    const unconfiguredNodes = nodes.filter(n =>
      !n.data.isRoot && !n.data.isConfigured
    )

    if (unconfiguredNodes.length > 0) {
      const ok = confirm(
        `미설정 노드가 ${unconfiguredNodes.length}개 있습니다. 미설정 노드는 저장에서 제외됩니다. 계속하시겠습니까?`
      )
      if (!ok) return
    }

    try {
      const tasks: PipelineTask[] = []
      const nodeById = new Map<string, Node>()
      nodes.forEach(n => nodeById.set(n.id, n))

      for (const edge of edges) {
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
          taskConfig: targetData.taskConfig || {}
        })
      }

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
    const nodeById = new Map<string, Node>()
    nodes.forEach(n => nodeById.set(n.id, n))

    const tasks: PipelineTask[] = []
    for (const edge of edges) {
      const targetNode = nodeById.get(edge.target)
      const sourceNode = nodeById.get(edge.source)
      if (!targetNode || !sourceNode) continue
      const td = targetNode.data as TaskNodeData
      const sd = sourceNode.data as TaskNodeData
      if (!td.taskCategory) continue

      tasks.push({
        name: td.taskName,
        trigger: sd.taskName,
        category: td.taskCategory,
        taskConfig: td.taskConfig || {}
      })
    }

    return {
      name: pipelineName || '',
      description: pipelineDesc || '',
      tasks
    }
  }, [nodes, edges, pipelineName, pipelineDesc])

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
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

        {/* Right: JSON Viewer + Property Panel */}
        <Box sx={{
          width: 360,
          borderLeft: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* 상단: JSON 뷰어 (선택 시 50%, 미선택 시 100%) */}
          <Box sx={{
            flex: selectedNode && !selectedNode.data.isRoot ? '0 0 50%' : 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.default'
          }}>
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
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
              color: 'text.secondary',
              whiteSpace: 'pre',
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.700', borderRadius: 3 },
            }}>
              {JSON.stringify(buildPipelineJson(), null, 2)}
            </Box>
          </Box>

          {/* 하단: 노드 속성 패널 (선택 시에만 표시, 50%) */}
          {selectedNode && !selectedNode.data.isRoot && (
            <Box sx={{
              flex: '0 0 50%',
              borderTop: 1,
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper'
            }}>
              <TaskPropertyPanel
                data={{
                  taskName: (selectedNode.data as TaskNodeData).taskName,
                  taskCategory: (selectedNode.data as TaskNodeData).taskCategory,
                  taskConfig: (selectedNode.data as TaskNodeData).taskConfig
                }}
                parentCategory={parentData?.taskCategory}
                isParentRoot={parentData?.isRoot}
                filters={filters}
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
        </Box>
      </Box>
    </Box>
  )
}
