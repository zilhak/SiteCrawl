import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Stack,
  Card,
  CardMedia,
  Link,
  Autocomplete,
  IconButton
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import type { CrawlResult, CrawlOptions, Pipeline, PipelineExecutionResult, ExecutionProgressEvent } from '../types'
import { crawlerService } from '../services/crawlerService'
import { pipelineService } from '../services/pipelineService'

interface CrawlingPageProps {
  options: CrawlOptions
  isStorageActive: boolean
}

export default function CrawlingPage({ options, isStorageActive }: CrawlingPageProps) {
  const [url, setUrl] = useState('https://example.com')
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<CrawlResult | null>(null)
  const [executionResult, setExecutionResult] = useState<PipelineExecutionResult | null>(null)

  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)

  const startCrawl = async () => {
    if (!url || isLoading) return

    setIsLoading(true)
    setProgress('시작...')
    setError('')
    setResult(null)
    setExecutionResult(null)

    if (selectedPipeline) {
      // 파이프라인 실행 모드
      try {
        setProgress('파이프라인 실행 중...')
        await pipelineService.execute(selectedPipeline.id, url)
        // 결과는 onExecutionComplete 이벤트로 수신
      } catch (err) {
        setError(err instanceof Error ? err.message : '파이프라인 실행 실패')
        setIsLoading(false)
      }
    } else {
      // 기존 단순 크롤링
      if (!options.includeAbsolutePaths && !options.includeRelativePaths) {
        setError('최소 하나의 경로 유형을 선택해야 합니다')
        setIsLoading(false)
        return
      }
      try {
        await crawlerService.startCrawl(url, false, options)
      } catch (err) {
        console.error('Crawl error:', err)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      startCrawl()
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ko-KR')
  }

  useEffect(() => {
    crawlerService.onProgress((data: unknown) => {
      const d = data as { message: string }
      setProgress(d.message)
    })

    crawlerService.onComplete((data: CrawlResult) => {
      setIsLoading(false)
      setProgress('')
      setResult(data)
    })

    crawlerService.onError((errorMsg: string) => {
      setIsLoading(false)
      setProgress('')
      setError(errorMsg)
    })

    // Pipeline execution events
    pipelineService.onExecutionProgress((event: unknown) => {
      const e = event as ExecutionProgressEvent
      setProgress(`[${e.taskName}] ${e.message}`)
    })

    pipelineService.onExecutionComplete((result: unknown) => {
      const r = result as PipelineExecutionResult
      setIsLoading(false)
      setProgress('')
      setExecutionResult(r)
    })

    pipelineService.onExecutionError((errorMsg: string) => {
      setIsLoading(false)
      setProgress('')
      setError(errorMsg)
    })

    const loadPipelines = async () => {
      try {
        const allPipelines = await pipelineService.getAll()
        setPipelines(allPipelines)
      } catch (err) {
        console.warn('파이프라인 로드 실패 (Electron 환경 필요):', err)
      }
    }

    void loadPipelines()
  }, [])

  return (
    <Box sx={{ p: 3 }}>
      {/* 파이프라인 선택 */}
      {selectedPipeline ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {selectedPipeline.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedPipeline.description || '설명 없음'}
            </Typography>
          </Box>
          <IconButton onClick={() => setSelectedPipeline(null)}>
            <CloseIcon />
          </IconButton>
        </Paper>
      ) : (
        <Autocomplete
          options={pipelines}
          getOptionLabel={(option) => option.name}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="파이프라인 검색 (선택사항)"
              InputProps={{
                ...params.InputProps,
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          )}
          renderOption={({ key, ...props }, option) => (
            <Box component="li" key={key} {...props}>
              <Box>
                <Typography variant="body2">{option.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.description || '설명 없음'}
                </Typography>
              </Box>
            </Box>
          )}
          onChange={(_, value) => setSelectedPipeline(value)}
          sx={{ mb: 3 }}
        />
      )}

      {/* URL 입력 */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="크롤링할 URL을 입력하세요 (예: https://example.com)"
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrowIcon />}
          onClick={startCrawl}
          disabled={isLoading || !url}
          sx={{ minWidth: 150 }}
        >
          {isLoading ? '크롤링 중...' : '크롤링 시작'}
        </Button>
      </Stack>

      {/* 진행 상태 */}
      {progress && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {progress}
        </Alert>
      )}

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 저장소 경고 */}
      {!isStorageActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          저장 데이터 경로를 설정하지 않으면 데이터 저장 기능이 비활성화됩니다
        </Alert>
      )}

      {/* 크롤링 결과 표시 */}
      {result ? (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            크롤링 결과
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                URL
              </Typography>
              <Typography variant="body1">{result.url}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                제목
              </Typography>
              <Typography variant="body1">{result.title}</Typography>
            </Box>

            {result.description && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  설명
                </Typography>
                <Typography variant="body1">{result.description}</Typography>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                스크린샷
              </Typography>
              <Card variant="outlined" sx={{ mt: 1 }}>
                <CardMedia
                  component="img"
                  image={result.screenshot}
                  alt="Screenshot"
                  sx={{ maxHeight: 600, objectFit: 'contain', bgcolor: 'background.default' }}
                />
              </Card>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                링크 ({result.links.length}개)
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
                <Stack spacing={1}>
                  {result.links.map((link, index) => (
                    <Link
                      key={index}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'block',
                        p: 1,
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      {link}
                    </Link>
                  ))}
                </Stack>
              </Paper>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                크롤링 시간
              </Typography>
              <Typography variant="body1">{formatTimestamp(result.timestamp)}</Typography>
            </Box>
          </Stack>
        </Paper>
      ) : null}

      {/* 파이프라인 실행 결과 */}
      {executionResult && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            파이프라인 실행 결과
          </Typography>

          <Alert severity={executionResult.status === 'completed' ? 'success' : executionResult.status === 'failed' ? 'error' : 'warning'} sx={{ mb: 2 }}>
            상태: {executionResult.status === 'completed' ? '완료' : executionResult.status === 'failed' ? '실패' : '부분 실패'}
            {executionResult.error && ` - ${executionResult.error}`}
          </Alert>

          <Stack spacing={2}>
            {executionResult.results.map((nodeResult, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" fontWeight={600}>
                    {nodeResult.taskName}
                  </Typography>
                  <Alert severity={nodeResult.success ? 'success' : 'error'} sx={{ py: 0 }}>
                    {nodeResult.success ? '성공' : '실패'}
                  </Alert>
                </Stack>
                {nodeResult.error && (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    {nodeResult.error}
                  </Typography>
                )}
                {nodeResult.output && nodeResult.output.type === 'strings' && nodeResult.category === 'string_display' && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      {(nodeResult.output as any).label || nodeResult.taskName} ({(nodeResult.output.value as string[]).length}개)
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'background.default' }}
                    >
                      {(nodeResult.output.value as string[]).map((item, i) => (
                        <Box
                          key={i}
                          sx={{
                            px: 1.5, py: 0.75,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            '&:last-child': { borderBottom: 'none' }
                          }}
                          onClick={() => {
                            try {
                              const ta = document.createElement('textarea')
                              ta.value = item
                              ta.style.position = 'fixed'
                              ta.style.opacity = '0'
                              document.body.appendChild(ta)
                              ta.select()
                              document.execCommand('copy')
                              document.body.removeChild(ta)
                            } catch { /* ignore */ }
                          }}
                          title="클릭하여 복사"
                        >
                          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                            {item}
                          </Typography>
                        </Box>
                      ))}
                    </Paper>
                  </Box>
                )}
                {nodeResult.output && nodeResult.output.type === 'strings' && nodeResult.category !== 'string_display' && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      결과: {(nodeResult.output.value as string[]).length}개 항목
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1, mt: 0.5, maxHeight: 200, overflow: 'auto' }}>
                      {(nodeResult.output.value as string[]).slice(0, 50).map((item, i) => (
                        <Typography key={i} variant="body2" sx={{ py: 0.25 }}>
                          {item}
                        </Typography>
                      ))}
                      {(nodeResult.output.value as string[]).length > 50 && (
                        <Typography variant="body2" color="text.secondary">
                          ...외 {(nodeResult.output.value as string[]).length - 50}개
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                )}
              </Paper>
            ))}
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            실행 시간: {new Date(executionResult.startedAt).toLocaleString('ko-KR')} ~ {new Date(executionResult.completedAt).toLocaleString('ko-KR')}
          </Typography>
        </Paper>
      )}

      {/* 플레이스홀더 */}
      {!result && !executionResult && !isLoading && (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            URL을 입력하고 크롤링을 시작하세요
          </Typography>
        </Paper>
      )}
    </Box>
  )
}
