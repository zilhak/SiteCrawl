import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  Alert,
  TablePagination,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import CloseIcon from '@mui/icons-material/Close'
import type { CrawlTask } from '../types'
import { taskService } from '../services/taskService'

interface CrawlTaskPageProps {
  isStorageActive: boolean
}

export default function CrawlTaskPage({ isStorageActive }: CrawlTaskPageProps) {
  const [tasks, setTasks] = useState<CrawlTask[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(20)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // 편집 모달 상태
  const [editingTask, setEditingTask] = useState<CrawlTask | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<'blacklist' | 'whitelist'>('blacklist')
  const [editLimit, setEditLimit] = useState<number>(-1)
  const [editPatterns, setEditPatterns] = useState<string[]>([])
  const [newPattern, setNewPattern] = useState('')

  const loadTasks = async (pageNum: number = 0) => {
    try {
      const result = await taskService.getTasksPaginated('crawl', pageNum + 1, rowsPerPage)
      setTasks(result.tasks as CrawlTask[])
      setTotal(result.total)
    } catch (err) {
      console.error('CrawlTask 로드 실패:', err)
    }
  }

  const handleAddTask = async () => {
    try {
      await taskService.createQuickCrawl()
      await loadTasks(page)
    } catch (err: any) {
      alert(`Task 생성 실패: ${err.message}`)
    }
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0) {
      alert('삭제할 항목을 선택해주세요.')
      return
    }

    if (!confirm(`${selected.size}개의 Task를 삭제하시겠습니까?`)) return

    try {
      const ids = Array.from(selected)
      const deleted = await taskService.deleteMultipleTasks(ids)
      alert(`${deleted}개의 Task가 삭제되었습니다.`)
      setSelected(new Set())
      await loadTasks(page)
    } catch (err: any) {
      alert(`Task 삭제 실패: ${err.message}`)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(tasks.map(t => t.id)))
    } else {
      setSelected(new Set())
    }
  }

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
    loadTasks(newPage)
  }

  const handleOpenEdit = (task: CrawlTask) => {
    setEditingTask(task)
    setEditName(task.name)
    setEditType(task.config.type)
    setEditLimit(task.config.limit)
    setEditPatterns([...task.config.patterns])
    setNewPattern('')
  }

  const handleCloseEdit = () => {
    setEditingTask(null)
  }

  const handleSaveEdit = async () => {
    if (!editingTask) return

    try {
      await taskService.updateCrawl(editingTask.id, {
        name: editName,
        type: editType,
        patterns: editPatterns,
        limit: editLimit
      })
      await loadTasks(page)
      handleCloseEdit()
    } catch (err: any) {
      alert(`Task 수정 실패: ${err.message}`)
    }
  }

  const handleAddPattern = () => {
    if (!newPattern.trim()) return
    if (editPatterns.includes(newPattern.trim())) {
      alert('이미 존재하는 패턴입니다')
      return
    }
    setEditPatterns([...editPatterns, newPattern.trim()])
    setNewPattern('')
  }

  const handleDeletePattern = (pattern: string) => {
    setEditPatterns(editPatterns.filter(p => p !== pattern))
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR')
  }

  useEffect(() => {
    if (isStorageActive) {
      loadTasks(0)
    }
  }, [isStorageActive])

  if (!isStorageActive) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          저장소가 설정되지 않았습니다. 옵션에서 저장 경로를 설정해주세요.
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            URL추출 태스크
          </Typography>
          <Typography variant="body2" color="text.secondary">
            URL을 필터링하여 다음 작업으로 전달하는 태스크를 관리합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddTask}
          >
            추가
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteSelected}
            disabled={selected.size === 0}
          >
            삭제 ({selected.size})
          </Button>
        </Stack>
      </Stack>

      {/* 테이블 */}
      {tasks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            등록된 URL추출 태스크가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary">
            + 추가 버튼을 눌러 새 태스크를 생성하세요.
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={tasks.length > 0 && selected.size === tasks.length}
                      indeterminate={selected.size > 0 && selected.size < tasks.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>이름</TableCell>
                  <TableCell>타입</TableCell>
                  <TableCell>패턴 개수</TableCell>
                  <TableCell>Limit</TableCell>
                  <TableCell>생성일</TableCell>
                  <TableCell align="center">편집</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    selected={selected.has(task.id)}
                    hover
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.has(task.id)}
                        onChange={() => handleSelectOne(task.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {task.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={task.config.type}
                        size="small"
                        color={task.config.type === 'whitelist' ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {task.config.patterns.length}개
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {task.config.limit === -1 ? '무제한' : task.config.limit}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(task.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenEdit(task)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[20]}
            labelRowsPerPage="페이지 당 행:"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} / 총 ${count}개`
            }
          />
        </Paper>
      )}

      {/* 편집 모달 */}
      <Dialog open={!!editingTask} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">태스크 편집</Typography>
            <IconButton onClick={handleCloseEdit} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* 이름 */}
            <TextField
              fullWidth
              label="이름"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            {/* 타입 */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                필터 모드
              </Typography>
              <RadioGroup
                value={editType}
                onChange={(e) => setEditType(e.target.value as 'blacklist' | 'whitelist')}
              >
                <FormControlLabel
                  value="blacklist"
                  control={<Radio />}
                  label="블랙리스트 (패턴에 해당하는 링크 제외)"
                />
                <FormControlLabel
                  value="whitelist"
                  control={<Radio />}
                  label="화이트리스트 (패턴에 해당하는 링크만 포함)"
                />
              </RadioGroup>
            </Box>

            {/* Limit */}
            <TextField
              fullWidth
              label="Limit (-1 = 무제한)"
              type="number"
              value={editLimit}
              onChange={(e) => setEditLimit(parseInt(e.target.value) || -1)}
            />

            {/* 패턴 목록 */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                URL 패턴
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="예: */products/*, */category/*"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddPattern()}
                />
                <Button variant="outlined" onClick={handleAddPattern}>
                  추가
                </Button>
              </Stack>

              {editPatterns.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    패턴이 없습니다. 패턴을 추가하세요.
                  </Typography>
                </Paper>
              ) : (
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <List dense>
                    {editPatterns.map((pattern, idx) => (
                      <ListItem key={idx}>
                        <ListItemText
                          primary={<code>{pattern}</code>}
                          primaryTypographyProps={{ fontFamily: 'monospace', fontSize: '13px' }}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" size="small" onClick={() => handleDeletePattern(pattern)}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit}>취소</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
