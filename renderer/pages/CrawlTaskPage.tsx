import { useState, useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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

// Zod 스키마 정의
const crawlTaskSchema = z.object({
  name: z.string()
    .min(1, '이름을 입력해주세요')
    .max(100, '이름은 100자 이하여야 합니다'),
  type: z.enum(['blacklist', 'whitelist']),
  limit: z.number().int(),
  patterns: z.array(z.string()),
  includeAbsolutePaths: z.boolean(),
  includeRelativePaths: z.boolean()
}).refine(
  data => data.includeAbsolutePaths || data.includeRelativePaths,
  {
    message: '최소 하나의 경로 타입을 선택해야 합니다',
    path: ['includeRelativePaths']
  }
)

type CrawlTaskFormData = z.infer<typeof crawlTaskSchema>

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
  const [newPattern, setNewPattern] = useState('')

  // React Hook Form
  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CrawlTaskFormData>({
    resolver: zodResolver(crawlTaskSchema),
    defaultValues: {
      name: '',
      type: 'blacklist',
      limit: -1,
      patterns: [],
      includeAbsolutePaths: true,
      includeRelativePaths: true
    }
  })

  const patterns = watch('patterns')

  const loadTasks = useCallback(async (pageNum: number = 0) => {
    try {
      const result = await taskService.getTasksPaginated('crawl', pageNum + 1, rowsPerPage)
      setTasks(result.tasks as CrawlTask[])
      setTotal(result.total)
    } catch (err) {
      console.error('CrawlTask 로드 실패:', err)
    }
  }, [rowsPerPage])

  const handleAddTask = async () => {
    try {
      await taskService.createQuickCrawl()
      await loadTasks(page)
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    reset({
      name: task.name,
      type: task.config.type,
      limit: task.config.limit,
      patterns: [...task.config.patterns],
      includeAbsolutePaths: task.config.includeAbsolutePaths ?? true,
      includeRelativePaths: task.config.includeRelativePaths ?? true
    })
    setNewPattern('')
  }

  const handleCloseEdit = () => {
    setEditingTask(null)
    reset()
  }

  const onSubmit = async (data: CrawlTaskFormData) => {
    if (!editingTask) return

    // 낙관적 업데이트: UI 즉시 반영
    const updatedTask: CrawlTask = {
      ...editingTask,
      name: data.name,
      config: {
        type: data.type,
        patterns: data.patterns,
        limit: data.limit,
        includeAbsolutePaths: data.includeAbsolutePaths,
        includeRelativePaths: data.includeRelativePaths
      },
      updatedAt: Date.now()
    }

    // UI 즉시 업데이트
    setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t))
    handleCloseEdit()

    // 백그라운드에서 DB 저장
    try {
      await taskService.updateCrawl(editingTask.id, {
        name: data.name,
        type: data.type,
        patterns: data.patterns,
        limit: data.limit,
        includeAbsolutePaths: data.includeAbsolutePaths,
        includeRelativePaths: data.includeRelativePaths
      })
    } catch (err: unknown) {
      alert(`Task 수정 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      // 실패 시 데이터 다시 로드하여 롤백
      await loadTasks(page)
    }
  }

  const handleAddPattern = () => {
    if (!newPattern.trim()) return
    if (patterns.includes(newPattern.trim())) {
      alert('이미 존재하는 패턴입니다')
      return
    }
    setValue('patterns', [...patterns, newPattern.trim()])
    setNewPattern('')
  }

  const handleDeletePattern = (pattern: string) => {
    setValue('patterns', patterns.filter(p => p !== pattern))
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR')
  }

  useEffect(() => {
    if (isStorageActive) {
      void loadTasks(0)
    }
  }, [isStorageActive, loadTasks])

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
        <form onSubmit={handleSubmit(onSubmit)}>
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
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
              />

              {/* 타입 */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  필터 모드
                </Typography>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup {...field}>
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
                  )}
                />
              </Box>

              {/* Limit */}
              <TextField
                fullWidth
                label="Limit (-1 = 무제한)"
                type="number"
                {...register('limit', { valueAsNumber: true })}
                error={!!errors.limit}
                helperText={errors.limit?.message}
              />

              {/* 경로 포함 옵션 */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  URL 경로 타입
                </Typography>
                <Controller
                  name="includeAbsolutePaths"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox {...field} checked={field.value} />}
                      label="절대경로 포함 (http://..., https://...)"
                    />
                  )}
                />
                <Controller
                  name="includeRelativePaths"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox {...field} checked={field.value} />}
                      label="상대경로 포함 (/page, ../image.png 등)"
                    />
                  )}
                />
                {errors.includeRelativePaths && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {errors.includeRelativePaths.message}
                  </Alert>
                )}
              </Box>

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

                {patterns.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      패턴이 없습니다. 패턴을 추가하세요.
                    </Typography>
                  </Paper>
                ) : (
                  <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <List dense>
                      {patterns.map((pattern, idx) => (
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
            <Button type="submit" variant="contained">
              저장
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
