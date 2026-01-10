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
import type { CrawlResult, CrawlOptions, Pipeline } from '../types'
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

  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)

  const startCrawl = async () => {
    if (!url || isLoading) return
    if (!options.includeAbsolutePaths && !options.includeRelativePaths) {
      setError('최소 하나의 경로 유형을 선택해야 합니다')
      return
    }

    setIsLoading(true)
    setProgress('크롤링 시작...')
    setError('')
    setResult(null)

    try {
      await crawlerService.startCrawl(url, false, options)
    } catch (err) {
      console.error('Crawl error:', err)
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
      setProgress(data.message)
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
          renderOption={(props, option) => (
            <Box component="li" {...props}>
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

      {/* 결과 표시 */}
      {result ? (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            📊 크롤링 결과
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
      ) : !isLoading ? (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            URL을 입력하고 크롤링을 시작하세요
          </Typography>
        </Paper>
      ) : null}
    </Box>
  )
}
