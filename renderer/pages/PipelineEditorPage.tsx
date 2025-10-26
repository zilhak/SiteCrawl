import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  IconButton,
  Stack,
  Chip,
  AppBar,
  Toolbar,
  InputAdornment
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import SaveIcon from '@mui/icons-material/Save'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  Handle,
  Position
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { Pipeline, AnyTask, CrawlTask, ActionTask } from '../types'
import { pipelineService } from '../services/pipelineService'
import { taskService } from '../services/taskService'

interface PipelineEditorPageProps {
  pipelineId: string | null
  onClose: () => void
}

interface TaskNodeData {
  nodeId: string
  taskId?: string
  taskName: string
  taskCategory?: 'crawl' | 'action'
  isRoot?: boolean
  onAddChild: (nodeId: string) => void
  onDelete: (nodeId: string) => void
}

// 커스텀 노드 컴포넌트
function TaskNode({ data }: { data: TaskNodeData }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{ position: 'relative' }}
    >
      <Handle type="target" position={Position.Top} />

      <Paper
        elevation={isHovered ? 6 : 2}
        sx={{
          px: 3,
          py: 1.5,
          minWidth: 140,
          textAlign: 'center',
          bgcolor: data.isRoot ? 'primary.main' : 'background.paper',
          color: data.isRoot ? 'white' : 'text.primary',
          transition: 'all 0.2s',
          border: isHovered ? '2px solid' : '2px solid transparent',
          borderColor: 'primary.main'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
          <Typography variant="body2" fontWeight={600}>
            {data.taskName}
          </Typography>
          {data.taskCategory && (
            <Chip
              label={data.taskCategory}
              size="small"
              color={data.taskCategory === 'crawl' ? 'primary' : 'secondary'}
              sx={{
                height: 18,
                fontSize: '10px',
                bgcolor: data.isRoot ? 'rgba(255,255,255,0.3)' : undefined,
                color: data.isRoot ? 'white' : undefined
              }}
            />
          )}
        </Stack>
      </Paper>

      {/* Add button on hover */}
      {isHovered && (
        <IconButton
          size="small"
          sx={{
            position: 'absolute',
            bottom: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'primary.main',
            color: 'white',
            width: 28,
            height: 28,
            boxShadow: 2,
            '&:hover': {
              bgcolor: 'primary.dark'
            },
            zIndex: 1000
          }}
          onClick={(e) => {
            e.stopPropagation()
            data.onAddChild(data.nodeId)
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      )}

      {/* Delete button (not for root) */}
      {!data.isRoot && isHovered && (
        <IconButton
          size="small"
          sx={{
            position: 'absolute',
            top: -12,
            right: -12,
            bgcolor: 'error.main',
            color: 'white',
            width: 24,
            height: 24,
            boxShadow: 2,
            '&:hover': {
              bgcolor: 'error.dark'
            },
            zIndex: 1000
          }}
          onClick={(e) => {
            e.stopPropagation()
            data.onDelete(data.nodeId)
          }}
        >
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}

      <Handle type="source" position={Position.Bottom} />
    </Box>
  )
}

export default function PipelineEditorPage({ pipelineId, onClose }: PipelineEditorPageProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [pipelineName, setPipelineName] = useState('')
  const [pipelineDesc, setPipelineDesc] = useState('')

  const nodeTypes: NodeTypes = useMemo(() => ({
    taskNode: TaskNode
  }), [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const [selectingParentId, setSelectingParentId] = useState<string | null>(null)
  const [availableTasks, setAvailableTasks] = useState<AnyTask[]>([])
  const [showTaskSelector, setShowTaskSelector] = useState(false)
  const [nodeCounter, setNodeCounter] = useState(0)

  // Task selector filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'crawl' | 'action'>('all')
  const [crawlTypeFilter, setCrawlTypeFilter] = useState<'all' | 'whitelist' | 'blacklist'>('all')

  // Pipeline item naming
  const [selectedTask, setSelectedTask] = useState<AnyTask | null>(null)
  const [pipelineItemName, setPipelineItemName] = useState('')
  const [showNameDialog, setShowNameDialog] = useState(false)

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    if (pipelineId) {
      loadPipeline()
    } else {
      initializeNodes()
    }
  }, [pipelineId])

  const loadPipeline = async () => {
    if (!pipelineId) {
      setPipelineName('')
      setPipelineDesc('')
      return
    }

    try {
      const data = await pipelineService.get(pipelineId)
      if (data) {
        setPipeline(data)
        setPipelineName(data.name)
        setPipelineDesc(data.description || '')
        loadNodesFromPipeline(data)
      }
    } catch (err) {
      console.error('파이프라인 로드 실패:', err)
      initializeNodes()
    }
  }

  const loadNodesFromPipeline = (pipeline: Pipeline) => {
    // Create root node
    const rootNode: Node = {
      id: 'root',
      type: 'taskNode',
      position: { x: 400, y: 50 },
      data: {
        nodeId: 'root',
        taskName: '_run_',
        isRoot: true,
        onAddChild: handleAddChild,
        onDelete: handleDeleteNode
      }
    }

    const newNodes: Node[] = [rootNode]
    const newEdges: Edge[] = []
    const nodeMap = new Map<string, Node>()
    nodeMap.set('_run_', rootNode)

    // Build task name to task map
    const taskMap = new Map<string, PipelineTask>()
    pipeline.tasks.forEach(task => {
      taskMap.set(task.name, task)
    })

    // Calculate layout: group tasks by their trigger (parent)
    const childrenByParent = new Map<string, PipelineTask[]>()
    pipeline.tasks.forEach(task => {
      const parent = task.trigger
      if (!childrenByParent.has(parent)) {
        childrenByParent.set(parent, [])
      }
      childrenByParent.get(parent)!.push(task)
    })

    // Recursive function to layout nodes
    let nodeCounter = 0
    const layoutNode = (parentName: string, parentNode: Node, depth: number) => {
      const children = childrenByParent.get(parentName) || []

      children.forEach((child, index) => {
        const nodeId = `node-${nodeCounter++}`
        const childNode: Node = {
          id: nodeId,
          type: 'taskNode',
          position: {
            x: parentNode.position.x + index * 200,
            y: parentNode.position.y + 150
          },
          data: {
            nodeId: nodeId,
            taskId: child.taskId,
            taskName: child.name,
            taskCategory: child.taskId ? (availableTasks.find(t => t.id === child.taskId)?.category) : undefined,
            onAddChild: handleAddChild,
            onDelete: handleDeleteNode
          }
        }

        newNodes.push(childNode)
        nodeMap.set(child.name, childNode)

        // Create edge
        const edge: Edge = {
          id: `edge-${parentNode.id}-${nodeId}`,
          source: parentNode.id,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed
          }
        }
        newEdges.push(edge)

        // Recursively layout children
        layoutNode(child.name, childNode, depth + 1)
      })
    }

    layoutNode('_run_', rootNode, 0)

    setNodes(newNodes)
    setEdges(newEdges)
    setNodeCounter(nodeCounter)
  }

  const loadTasks = async () => {
    try {
      const tasks = await taskService.getAllTasks()
      setAvailableTasks(tasks)
    } catch (err) {
      console.error('Task 로드 실패:', err)
    }
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
        onAddChild: handleAddChild,
        onDelete: handleDeleteNode
      }
    }
    setNodes([rootNode])
    setEdges([])
  }

  const handleAddChild = useCallback((parentId: string) => {
    setSelectingParentId(parentId)
    setSearchQuery('')
    setCategoryFilter('all')
    setCrawlTypeFilter('all')
    setShowTaskSelector(true)
  }, [])

  const handleDeleteNode = useCallback((nodeId: string) => {
    // 자식 노드들도 함께 삭제
    const findDescendants = (id: string): string[] => {
      const children = edges.filter(e => e.source === id).map(e => e.target)
      return [id, ...children.flatMap(findDescendants)]
    }

    const toDelete = findDescendants(nodeId)
    setNodes((nds) => nds.filter(n => !toDelete.includes(n.id)))
    setEdges((eds) => eds.filter(e => !toDelete.includes(e.source) && !toDelete.includes(e.target)))
  }, [edges])

  const handleSelectTask = (task: AnyTask) => {
    // Generate unique default name
    const existingNames = nodes.map(n => n.data.taskName)
    let defaultName = task.name
    let counter = 1

    while (existingNames.includes(defaultName)) {
      counter++
      defaultName = `${task.name}_${counter}`
    }

    // Open name dialog
    setSelectedTask(task)
    setPipelineItemName(defaultName)
    setShowTaskSelector(false)
    setShowNameDialog(true)
  }

  const handleConfirmPipelineItem = () => {
    if (!selectingParentId || !selectedTask) return

    if (!pipelineItemName.trim()) {
      alert('파이프라인 아이템 이름을 입력해주세요.')
      return
    }

    // Check if root already has a child
    if (selectingParentId === 'root') {
      const rootChildren = edges.filter(e => e.source === 'root')
      if (rootChildren.length > 0) {
        alert('_run_에는 하나의 태스크만 연결할 수 있습니다.')
        setShowNameDialog(false)
        setSelectingParentId(null)
        setSelectedTask(null)
        setPipelineItemName('')
        return
      }
    }

    // Check for duplicate name
    const existingNames = nodes.map(n => n.data.taskName)
    if (existingNames.includes(pipelineItemName.trim())) {
      alert('이미 존재하는 이름입니다. 다른 이름을 사용해주세요.')
      return
    }

    const newNodeId = `node-${nodeCounter}`
    setNodeCounter(prev => prev + 1)

    // 부모 노드 찾기
    const parentNode = nodes.find(n => n.id === selectingParentId)
    if (!parentNode) return

    // 부모의 자식 개수 세기
    const childCount = edges.filter(e => e.source === selectingParentId).length

    // 새 노드 위치 계산 (부모 아래, 옆으로 배치)
    // 첫 번째 자식은 부모 바로 아래(offset 0), 이후는 오른쪽으로 200px씩
    const newNode: Node = {
      id: newNodeId,
      type: 'taskNode',
      position: {
        x: parentNode.position.x + childCount * 200,
        y: parentNode.position.y + 150
      },
      data: {
        nodeId: newNodeId,
        taskId: selectedTask.id,
        taskName: pipelineItemName.trim(),
        taskCategory: selectedTask.category,
        onAddChild: handleAddChild,
        onDelete: handleDeleteNode
      }
    }

    // 새 엣지
    const newEdge: Edge = {
      id: `edge-${selectingParentId}-${newNodeId}`,
      source: selectingParentId,
      target: newNodeId,
      type: 'smoothstep',
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed
      }
    }

    setNodes((nds) => [...nds, newNode])
    setEdges((eds) => [...eds, newEdge])
    setShowNameDialog(false)
    setSelectingParentId(null)
    setSelectedTask(null)
    setPipelineItemName('')
  }

  // Filter tasks based on search and filters
  const getFilteredTasks = () => {
    return availableTasks.filter(task => {
      // Search filter
      if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Category filter
      if (categoryFilter !== 'all' && task.category !== categoryFilter) {
        return false
      }

      // Crawl type filter (only for crawl tasks)
      if (crawlTypeFilter !== 'all' && task.category === 'crawl') {
        const crawlTask = task as CrawlTask
        if (crawlTask.config.type !== crawlTypeFilter) {
          return false
        }
      }

      return true
    })
  }

  const handleSave = async () => {
    if (!pipelineName.trim()) {
      alert('파이프라인 이름을 입력해주세요.')
      return
    }

    try {
      // Convert nodes/edges to PipelineTask[]
      const tasks: PipelineTask[] = []

      // Build a map of node id to node data
      const nodeById = new Map<string, Node>()
      nodes.forEach(node => {
        nodeById.set(node.id, node)
      })

      // For each edge, create a PipelineTask
      edges.forEach(edge => {
        const sourceNode = nodeById.get(edge.source)
        const targetNode = nodeById.get(edge.target)

        if (!sourceNode || !targetNode) return

        const sourceData = sourceNode.data as TaskNodeData
        const targetData = targetNode.data as TaskNodeData

        // Skip if target doesn't have a taskId (shouldn't happen)
        if (!targetData.taskId) return

        tasks.push({
          taskId: targetData.taskId,
          name: targetData.taskName,
          trigger: sourceData.taskName
        })
      })

      // Create or update pipeline
      if (pipelineId) {
        // Update existing pipeline
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
        // Create new pipeline
        const newPipeline = await pipelineService.create(pipelineName, pipelineDesc)
        if (newPipeline) {
          // Update tasks
          const updatedPipeline: Pipeline = {
            ...newPipeline,
            tasks
          }
          const result = await pipelineService.save(updatedPipeline)
          if (result.success) {
            alert('파이프라인이 생성되었습니다.')
            onClose()
          } else {
            alert(`저장 실패: ${result.error}`)
          }
        }
      }
    } catch (err: any) {
      console.error('파이프라인 저장 실패:', err)
      alert(`파이프라인 저장 실패: ${err.message}`)
    }
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <TextField
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              placeholder="파이프라인 이름"
              variant="standard"
              sx={{ minWidth: 300, mb: 0.5 }}
              InputProps={{
                style: { fontSize: '18px', fontWeight: 600 }
              }}
            />
            <TextField
              value={pipelineDesc}
              onChange={(e) => setPipelineDesc(e.target.value)}
              placeholder="설명 (선택사항)"
              variant="standard"
              fullWidth
              sx={{ maxWidth: 500 }}
              InputProps={{
                style: { fontSize: '14px' }
              }}
            />
          </Box>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!pipelineName.trim()}
          >
            저장
          </Button>
        </Toolbar>
      </AppBar>

      {/* React Flow Canvas */}
      <Box sx={{ flex: 1, bgcolor: 'grey.50' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          {/* Optional: Add Background, Controls, MiniMap */}
        </ReactFlow>
      </Box>

      {/* Pipeline Item Name Dialog */}
      <Dialog
        open={showNameDialog}
        onClose={() => setShowNameDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>파이프라인 아이템 이름 설정</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {selectedTask && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  선택한 태스크
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={500}>
                      {selectedTask.name}
                    </Typography>
                    <Chip
                      label={selectedTask.category === 'crawl' ? 'URL추출' : '작업'}
                      size="small"
                      color={selectedTask.category === 'crawl' ? 'primary' : 'secondary'}
                    />
                    {selectedTask.category === 'crawl' && (
                      <Chip
                        label={(selectedTask as CrawlTask).config.type === 'whitelist' ? '화이트리스트' : '블랙리스트'}
                        size="small"
                        color={(selectedTask as CrawlTask).config.type === 'whitelist' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Box>
              </Box>
            )}

            <TextField
              fullWidth
              label="파이프라인 아이템 이름"
              value={pipelineItemName}
              onChange={(e) => setPipelineItemName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmPipelineItem()
                }
              }}
              autoFocus
              helperText="같은 태스크를 여러 번 사용할 수 있습니다. 각 아이템마다 고유한 이름을 지정하세요."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNameDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleConfirmPipelineItem}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* Task Selector Dialog */}
      <Dialog
        open={showTaskSelector}
        onClose={() => setShowTaskSelector(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>태스크 선택</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Search */}
            <TextField
              fullWidth
              size="small"
              placeholder="태스크 이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />

            {/* Category Filter */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                카테고리
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  label="전체"
                  size="small"
                  color={categoryFilter === 'all' ? 'primary' : 'default'}
                  onClick={() => setCategoryFilter('all')}
                  sx={{ cursor: 'pointer' }}
                />
                <Chip
                  label="URL추출"
                  size="small"
                  color={categoryFilter === 'crawl' ? 'primary' : 'default'}
                  onClick={() => setCategoryFilter('crawl')}
                  sx={{ cursor: 'pointer' }}
                />
                <Chip
                  label="작업"
                  size="small"
                  color={categoryFilter === 'action' ? 'secondary' : 'default'}
                  onClick={() => setCategoryFilter('action')}
                  sx={{ cursor: 'pointer' }}
                />
              </Stack>
            </Box>

            {/* Crawl Type Filter (only show when category is crawl or all) */}
            {(categoryFilter === 'all' || categoryFilter === 'crawl') && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  URL추출 방식
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip
                    label="전체"
                    size="small"
                    color={crawlTypeFilter === 'all' ? 'primary' : 'default'}
                    onClick={() => setCrawlTypeFilter('all')}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Chip
                    label="화이트리스트"
                    size="small"
                    color={crawlTypeFilter === 'whitelist' ? 'success' : 'default'}
                    onClick={() => setCrawlTypeFilter('whitelist')}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Chip
                    label="블랙리스트"
                    size="small"
                    color={crawlTypeFilter === 'blacklist' ? 'error' : 'default'}
                    onClick={() => setCrawlTypeFilter('blacklist')}
                    sx={{ cursor: 'pointer' }}
                  />
                </Stack>
              </Box>
            )}

            {/* Task List */}
            {availableTasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                사용 가능한 태스크가 없습니다.
                <br />
                먼저 URL추출 태스크 또는 작업 태스크를 생성하세요.
              </Typography>
            ) : (
              <>
                {getFilteredTasks().length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    검색 결과가 없습니다.
                  </Typography>
                ) : (
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                    <List disablePadding>
                      {getFilteredTasks().map((task) => (
                        <ListItem key={task.id} disablePadding>
                          <ListItemButton onClick={() => handleSelectTask(task)}>
                            <ListItemText
                              primary={task.name}
                              secondary={
                                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                  <Chip
                                    label={task.category === 'crawl' ? 'URL추출' : '작업'}
                                    size="small"
                                    color={task.category === 'crawl' ? 'primary' : 'secondary'}
                                  />
                                  {task.category === 'crawl' && (
                                    <Chip
                                      label={(task as CrawlTask).config.type === 'whitelist' ? '화이트리스트' : '블랙리스트'}
                                      size="small"
                                      color={(task as CrawlTask).config.type === 'whitelist' ? 'success' : 'error'}
                                      variant="outlined"
                                    />
                                  )}
                                </Stack>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTaskSelector(false)}>취소</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
