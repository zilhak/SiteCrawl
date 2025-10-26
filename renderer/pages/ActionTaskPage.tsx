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
  Alert,
  TablePagination,
  Stack
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import type { ActionTask } from '../types'
import { taskService } from '../services/taskService'

interface ActionTaskPageProps {
  isStorageActive: boolean
}

export default function ActionTaskPage({ isStorageActive }: ActionTaskPageProps) {
  const [tasks, setTasks] = useState<ActionTask[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage] = useState(20)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadTasks = async (pageNum: number = 0) => {
    try {
      const result = await taskService.getTasksPaginated('action', pageNum + 1, rowsPerPage)
      setTasks(result.tasks as ActionTask[])
      setTotal(result.total)
    } catch (err) {
      console.error('ActionTask 로드 실패:', err)
    }
  }

  const handleAddTask = async () => {
    try {
      await taskService.createQuickAction()
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
            작업 태스크
          </Typography>
          <Typography variant="body2" color="text.secondary">
            URL을 입력받아 데이터를 수집하거나 작업을 수행하는 태스크를 관리합니다.
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
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => alert('편집 기능은 개발 중입니다.')}
            disabled={selected.size === 0}
          >
            편집
          </Button>
        </Stack>
      </Stack>

      {/* 테이블 */}
      {tasks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            등록된 작업 태스크가 없습니다
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
                  <TableCell>액션</TableCell>
                  <TableCell>결과 이름</TableCell>
                  <TableCell>생성일</TableCell>
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
                      <Typography variant="body2" color="text.secondary">
                        {task.config.action}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {task.config.resultName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(task.createdAt)}
                      </Typography>
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
    </Box>
  )
}
