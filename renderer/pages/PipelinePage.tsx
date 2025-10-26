import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  Stack,
  Card,
  CardContent,
  CardActions,
  Chip
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Pipeline } from '../types'
import { pipelineService } from '../services/pipelineService'

interface PipelinePageProps {
  isStorageActive: boolean
  onEditPipeline: (pipelineId: string | null) => void
  refreshKey?: number
}

export default function PipelinePage({ isStorageActive, onEditPipeline, refreshKey }: PipelinePageProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])

  const loadPipelines = async () => {
    try {
      const allPipelines = await pipelineService.getAll()
      setPipelines(allPipelines)
    } catch (err) {
      console.error('파이프라인 로드 실패:', err)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 파이프라인을 삭제하시겠습니까?`)) return

    try {
      const success = await pipelineService.delete(id)
      if (success) {
        await loadPipelines()
        alert('파이프라인이 삭제되었습니다.')
      } else {
        alert('파이프라인 삭제에 실패했습니다.')
      }
    } catch (err: any) {
      alert(`파이프라인 삭제 실패: ${err.message}`)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR')
  }

  useEffect(() => {
    if (isStorageActive) {
      loadPipelines()
    }
  }, [isStorageActive, refreshKey])

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
            파이프라인
          </Typography>
          <Typography variant="body2" color="text.secondary">
            태스크들을 연결하여 자동화 워크플로우를 구성합니다.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onEditPipeline(null)}
        >
          새 파이프라인 추가
        </Button>
      </Stack>

      {/* 파이프라인 목록 */}
      {pipelines.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            등록된 파이프라인이 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary">
            새 파이프라인을 추가하여 크롤링 워크플로우를 자동화하세요.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id} variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {pipeline.name}
                    </Typography>
                    {pipeline.description && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {pipeline.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      <Chip
                        label={`태스크: ${pipeline.tasks.length}개`}
                        size="small"
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">
                        생성: {formatTimestamp(pipeline.createdAt)}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => onEditPipeline(pipeline.id)}
                >
                  편집
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDelete(pipeline.id, pipeline.name)}
                >
                  삭제
                </Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}
