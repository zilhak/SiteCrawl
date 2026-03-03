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
  IconButton,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import CloseIcon from '@mui/icons-material/Close'
import type { Task, TaskCategory } from '../types'
import { taskService } from '../services/taskService'

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  string_filter: '문자열 필터',
  page_navigation: '페이지 이동',
  link_extraction: '링크 추출',
  resource_extraction: '리소스 추출',
  string_db_save: 'DB 저장',
  string_display: '화면 표시'
}

const ALL_CATEGORIES: TaskCategory[] = [
  'string_filter',
  'page_navigation',
  'link_extraction',
  'resource_extraction',
  'string_db_save',
  'string_display'
]

// --- Zod 스키마 ---
const baseSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이하여야 합니다')
})

const stringFilterSchema = baseSchema.extend({
  limit: z.number().int().min(-1)
})

const pageNavigationSchema = baseSchema.extend({
  waitUntil: z.enum(['domcontentloaded', 'load', 'networkidle']),
  timeout: z.number().int().min(0),
  handleCookies: z.boolean()
})

const linkExtractionSchema = baseSchema.extend({
  includeHrefLinks: z.boolean(),
  includeTextUrls: z.boolean(),
  includeAbsolutePaths: z.boolean(),
  includeRelativePaths: z.boolean()
})

const resourceExtractionSchema = baseSchema.extend({
  resourceTypes: z.array(z.enum(['image', 'pdf', 'video', 'css', 'js']))
})

const stringDbSaveSchema = baseSchema.extend({
  deduplication: z.boolean()
})

const stringDisplaySchema = baseSchema.extend({
  label: z.string().optional()
})

// 편집 폼 데이터 타입 (모든 필드의 합집합)
type EditFormData = {
  name: string
  // string_filter
  limit?: number
  // page_navigation
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle'
  timeout?: number
  handleCookies?: boolean
  // link_extraction
  includeHrefLinks?: boolean
  includeTextUrls?: boolean
  includeAbsolutePaths?: boolean
  includeRelativePaths?: boolean
  // resource_extraction
  resourceTypes?: ('image' | 'pdf' | 'video' | 'css' | 'js')[]
  // string_db_save
  deduplication?: boolean
  // string_display
  label?: string
}

interface TaskManagementPageProps {
  isStorageActive: boolean
}

export default function TaskManagementPage({ isStorageActive }: TaskManagementPageProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(20)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all')

  // 편집 모달 상태
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [resourceTypesState, setResourceTypesState] = useState<string[]>([])

  // React Hook Form
  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EditFormData>({
    defaultValues: {
      name: '',
      limit: -1,
      waitUntil: 'domcontentloaded',
      timeout: 30000,
      handleCookies: false,
      includeHrefLinks: true,
      includeTextUrls: false,
      includeAbsolutePaths: true,
      includeRelativePaths: true,
      resourceTypes: []
    }
  })

  const loadTasks = useCallback(async (pageNum: number = 0, filter: 'all' | TaskCategory = 'all') => {
    try {
      if (filter === 'all') {
        const allTasks = await taskService.getAll()
        const start = pageNum * rowsPerPage
        const sliced = allTasks.slice(start, start + rowsPerPage)
        setTasks(sliced)
        setTotal(allTasks.length)
      } else {
        const result = await taskService.getPaginated(filter, pageNum + 1, rowsPerPage)
        setTasks(result.tasks)
        setTotal(result.total)
      }
    } catch (err) {
      console.error('Task 로드 실패:', err)
    }
  }, [rowsPerPage])

  const handleAddTask = async () => {
    // 카테고리 필터가 'all'이면 첫 번째 카테고리로 생성
    const category: TaskCategory = categoryFilter === 'all' ? 'string_filter' : categoryFilter
    try {
      await taskService.createQuick(category)
      await loadTasks(page, categoryFilter)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류'
      alert(`Task 생성 실패: ${msg}`)
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
      const deleted = await taskService.deleteMultiple(ids)
      alert(`${deleted}개의 Task가 삭제되었습니다.`)
      setSelected(new Set())
      await loadTasks(page, categoryFilter)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류'
      alert(`Task 삭제 실패: ${msg}`)
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
    void loadTasks(newPage, categoryFilter)
  }

  const handleCategoryFilterChange = (filter: 'all' | TaskCategory) => {
    setCategoryFilter(filter)
    setPage(0)
    setSelected(new Set())
    void loadTasks(0, filter)
  }

  const buildDefaultValues = (task: Task): EditFormData => {
    const cfg = task.config as Record<string, unknown>
    const base: EditFormData = { name: task.name }

    if (task.category === 'string_filter') {
      base.limit = typeof cfg.limit === 'number' ? cfg.limit : -1
    } else if (task.category === 'page_navigation') {
      base.waitUntil = (cfg.waitUntil as 'domcontentloaded' | 'load' | 'networkidle') ?? 'domcontentloaded'
      base.timeout = typeof cfg.timeout === 'number' ? cfg.timeout : 30000
      base.handleCookies = typeof cfg.handleCookies === 'boolean' ? cfg.handleCookies : false
    } else if (task.category === 'link_extraction') {
      base.includeHrefLinks = typeof cfg.includeHrefLinks === 'boolean' ? cfg.includeHrefLinks : true
      base.includeTextUrls = typeof cfg.includeTextUrls === 'boolean' ? cfg.includeTextUrls : false
      base.includeAbsolutePaths = typeof cfg.includeAbsolutePaths === 'boolean' ? cfg.includeAbsolutePaths : true
      base.includeRelativePaths = typeof cfg.includeRelativePaths === 'boolean' ? cfg.includeRelativePaths : true
    } else if (task.category === 'resource_extraction') {
      const rt = Array.isArray(cfg.resourceTypes) ? (cfg.resourceTypes as string[]) : []
      base.resourceTypes = rt as ('image' | 'pdf' | 'video' | 'css' | 'js')[]
      setResourceTypesState(rt)
    } else if (task.category === 'string_db_save') {
      base.deduplication = typeof cfg.deduplication === 'boolean' ? cfg.deduplication : false
    } else if (task.category === 'string_display') {
      base.label = typeof cfg.label === 'string' ? cfg.label : ''
    }

    return base
  }

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task)
    const defaults = buildDefaultValues(task)
    reset(defaults)
  }

  const handleCloseEdit = () => {
    setEditingTask(null)
    reset()
    setResourceTypesState([])
  }

  const onSubmit = async (data: EditFormData) => {
    if (!editingTask) return

    let configUpdate: Record<string, unknown> = {}

    if (editingTask.category === 'string_filter') {
      // validate
      const parsed = stringFilterSchema.safeParse(data)
      if (!parsed.success) {
        alert(parsed.error.issues[0].message)
        return
      }
      configUpdate = { limit: data.limit ?? -1 }
    } else if (editingTask.category === 'page_navigation') {
      const parsed = pageNavigationSchema.safeParse(data)
      if (!parsed.success) {
        alert(parsed.error.issues[0].message)
        return
      }
      configUpdate = {
        waitUntil: data.waitUntil,
        timeout: data.timeout,
        handleCookies: data.handleCookies
      }
    } else if (editingTask.category === 'link_extraction') {
      const parsed = linkExtractionSchema.safeParse(data)
      if (!parsed.success) {
        alert(parsed.error.issues[0].message)
        return
      }
      configUpdate = {
        includeHrefLinks: data.includeHrefLinks,
        includeTextUrls: data.includeTextUrls,
        includeAbsolutePaths: data.includeAbsolutePaths,
        includeRelativePaths: data.includeRelativePaths
      }
    } else if (editingTask.category === 'resource_extraction') {
      const parsed = resourceExtractionSchema.safeParse({ ...data, resourceTypes: resourceTypesState })
      if (!parsed.success) {
        alert(parsed.error.issues[0].message)
        return
      }
      configUpdate = { resourceTypes: resourceTypesState }
    } else if (editingTask.category === 'string_db_save') {
      const parsed = stringDbSaveSchema.safeParse(data)
      if (!parsed.success) {
        alert(parsed.error.issues[0].message)
        return
      }
      configUpdate = { deduplication: data.deduplication ?? false }
    } else if (editingTask.category === 'string_display') {
      const parsed = stringDisplaySchema.safeParse(data)
      if (!parsed.success) {
        alert(parsed.error.issues[0].message)
        return
      }
      configUpdate = { label: data.label ?? '' }
    }

    // 낙관적 업데이트
    const updatedTask: Task = {
      ...editingTask,
      name: data.name,
      config: { ...editingTask.config, ...configUpdate },
      updatedAt: Date.now()
    }
    setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t))
    handleCloseEdit()

    try {
      await taskService.update(editingTask.id, {
        name: data.name,
        config: configUpdate
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류'
      alert(`Task 수정 실패: ${msg}`)
      await loadTasks(page, categoryFilter)
    }
  }

  const toggleResourceType = (type: string) => {
    setResourceTypesState(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR')
  }

  const getConfigSummary = (task: Task): string => {
    const cfg = task.config as Record<string, unknown>
    if (task.category === 'string_filter') {
      const limit = typeof cfg.limit === 'number' ? cfg.limit : -1
      return `limit: ${limit === -1 ? '무제한' : limit}`
    } else if (task.category === 'page_navigation') {
      const waitUntil = cfg.waitUntil ?? 'domcontentloaded'
      const timeout = cfg.timeout ?? 30000
      return `${waitUntil} / ${timeout}ms`
    } else if (task.category === 'link_extraction') {
      const count = [
        cfg.includeHrefLinks,
        cfg.includeTextUrls,
        cfg.includeAbsolutePaths,
        cfg.includeRelativePaths
      ].filter(Boolean).length
      return `${count}개 옵션 활성`
    } else if (task.category === 'resource_extraction') {
      const rt = Array.isArray(cfg.resourceTypes) ? cfg.resourceTypes : []
      return `${rt.length}개 리소스 타입`
    } else if (task.category === 'string_db_save') {
      return cfg.deduplication ? '중복 제거' : '전체 저장'
    } else if (task.category === 'string_display') {
      return cfg.label ? `제목: ${cfg.label}` : '기본 표시'
    }
    return ''
  }

  useEffect(() => {
    if (isStorageActive) {
      void loadTasks(0, categoryFilter)
    }
  }, [isStorageActive, loadTasks])  // categoryFilter는 loadTasks 호출에 별도 인자로 넘김

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
            태스크 관리
          </Typography>
          <Typography variant="body2" color="text.secondary">
            문자열 필터, 페이지 이동, 링크 추출, 리소스 추출 태스크를 통합 관리합니다.
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

      {/* 카테고리 필터 */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
        <Chip
          label="전체"
          color={categoryFilter === 'all' ? 'primary' : 'default'}
          onClick={() => handleCategoryFilterChange('all')}
          sx={{ cursor: 'pointer' }}
        />
        {ALL_CATEGORIES.map(cat => (
          <Chip
            key={cat}
            label={CATEGORY_LABELS[cat]}
            color={categoryFilter === cat ? 'primary' : 'default'}
            onClick={() => handleCategoryFilterChange(cat)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>

      {/* 테이블 */}
      {tasks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            등록된 태스크가 없습니다
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
                  <TableCell>카테고리</TableCell>
                  <TableCell>설명</TableCell>
                  <TableCell>생성일</TableCell>
                  <TableCell align="center">편집</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id} selected={selected.has(task.id)} hover>
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
                        label={CATEGORY_LABELS[task.category]}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {task.description || getConfigSummary(task)}
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
                {...register('name', { required: '이름을 입력해주세요' })}
                error={!!errors.name}
                helperText={errors.name?.message}
              />

              {/* 카테고리 표시 */}
              {editingTask && (
                <Box>
                  <Typography variant="caption" color="text.secondary">카테고리</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={CATEGORY_LABELS[editingTask.category]}
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              )}

              {/* string_filter 전용 필드 */}
              {editingTask?.category === 'string_filter' && (
                <TextField
                  fullWidth
                  label="Limit (-1 = 무제한)"
                  type="number"
                  {...register('limit', { valueAsNumber: true })}
                  error={!!errors.limit}
                  helperText={errors.limit?.message}
                />
              )}

              {/* page_navigation 전용 필드 */}
              {editingTask?.category === 'page_navigation' && (
                <>
                  <FormControl fullWidth>
                    <InputLabel>waitUntil</InputLabel>
                    <Controller
                      name="waitUntil"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} label="waitUntil">
                          <MenuItem value="domcontentloaded">domcontentloaded</MenuItem>
                          <MenuItem value="load">load</MenuItem>
                          <MenuItem value="networkidle">networkidle</MenuItem>
                        </Select>
                      )}
                    />
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Timeout (ms)"
                    type="number"
                    {...register('timeout', { valueAsNumber: true })}
                    error={!!errors.timeout}
                    helperText={errors.timeout?.message}
                  />
                  <Controller
                    name="handleCookies"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value ?? false} />}
                        label="쿠키 처리"
                      />
                    )}
                  />
                </>
              )}

              {/* link_extraction 전용 필드 */}
              {editingTask?.category === 'link_extraction' && (
                <>
                  <Controller
                    name="includeHrefLinks"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value ?? true} />}
                        label="href 링크 포함"
                      />
                    )}
                  />
                  <Controller
                    name="includeTextUrls"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value ?? false} />}
                        label="텍스트 URL 포함"
                      />
                    )}
                  />
                  <Controller
                    name="includeAbsolutePaths"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value ?? true} />}
                        label="절대경로 포함 (http://...)"
                      />
                    )}
                  />
                  <Controller
                    name="includeRelativePaths"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value ?? true} />}
                        label="상대경로 포함 (/page, ../...)"
                      />
                    )}
                  />
                </>
              )}

              {/* resource_extraction 전용 필드 */}
              {editingTask?.category === 'resource_extraction' && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    리소스 타입 선택
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                    {(['image', 'pdf', 'video', 'css', 'js'] as const).map(type => (
                      <Chip
                        key={type}
                        label={type}
                        color={resourceTypesState.includes(type) ? 'primary' : 'default'}
                        onClick={() => toggleResourceType(type)}
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* string_display 전용 필드 */}
              {editingTask?.category === 'string_display' && (
                <TextField
                  fullWidth
                  label="표시 제목 (선택)"
                  placeholder="예: 추출된 링크 목록"
                  {...register('label')}
                />
              )}

              {/* string_db_save 전용 필드 */}
              {editingTask?.category === 'string_db_save' && (
                <Controller
                  name="deduplication"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value ?? false} />}
                      label="중복 제거 (이미 저장된 문자열 건너뛰기)"
                    />
                  )}
                />
              )}
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
