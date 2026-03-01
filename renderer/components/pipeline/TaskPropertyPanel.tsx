/**
 * Task 속성 편집 패널 (독립 컴포넌트)
 * 파이프라인 에디터의 우측 패널에서 사용하며, 향후 별도 페이지에서도 재사용 가능
 */

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Divider
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import type { TaskCategory, Filter } from '../../types'
import { TASK_IO_MAP, CATEGORY_LABELS, CATEGORY_COLORS, IO_TYPE_LABELS } from '../../constants/taskIO'

export interface TaskPropertyData {
  taskName: string
  taskCategory?: TaskCategory
  taskConfig?: Record<string, unknown>
}

interface TaskPropertyPanelProps {
  data: TaskPropertyData
  parentCategory?: TaskCategory  // 부모 노드의 카테고리 (IO 호환성 표시)
  isParentRoot?: boolean         // 부모가 _run_인지
  filters: Filter[]
  onUpdate: (updates: Partial<TaskPropertyData>) => void
  onClose: () => void
}

// 카테고리별 기본 config
function getDefaultConfig(category: TaskCategory): Record<string, unknown> {
  switch (category) {
    case 'string_filter':
      return { preFilterId: '', postFilterId: '', limit: -1 }
    case 'page_navigation':
      return { waitUntil: 'domcontentloaded', timeout: 30000, handleCookies: true }
    case 'string_extraction':
      return { includeHrefLinks: true, includeTextUrls: true, includeAbsolutePaths: true, includeRelativePaths: true, postFilterId: '' }
    case 'resource_extraction':
      return { resourceTypes: ['image'], filterId: '' }
  }
}

// IO 호환성 체크
function getIOCompatibility(
  parentCategory: TaskCategory | undefined,
  isParentRoot: boolean,
  currentCategory: TaskCategory | undefined
): 'compatible' | 'incompatible' | 'unknown' {
  if (!currentCategory) return 'unknown'

  const parentOutput = isParentRoot ? 'url' : parentCategory ? TASK_IO_MAP[parentCategory].output : null
  if (!parentOutput) return 'unknown'

  const currentInput = TASK_IO_MAP[currentCategory].input
  return parentOutput === currentInput ? 'compatible' : 'incompatible'
}

export default function TaskPropertyPanel({
  data,
  parentCategory,
  isParentRoot,
  filters,
  onUpdate,
  onClose
}: TaskPropertyPanelProps) {
  const [name, setName] = useState(data.taskName)
  const [category, setCategory] = useState<TaskCategory | undefined>(data.taskCategory)
  const [config, setConfig] = useState<Record<string, unknown>>(
    data.taskConfig || (data.taskCategory ? getDefaultConfig(data.taskCategory) : {})
  )

  // data가 변경되면 로컬 상태 동기화
  useEffect(() => {
    setName(data.taskName)
    setCategory(data.taskCategory)
    setConfig(data.taskConfig || (data.taskCategory ? getDefaultConfig(data.taskCategory) : {}))
  }, [data.taskName, data.taskCategory, data.taskConfig])

  const handleCategoryChange = (newCategory: TaskCategory) => {
    setCategory(newCategory)
    setConfig(getDefaultConfig(newCategory))
  }

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleApply = () => {
    onUpdate({
      taskName: name,
      taskCategory: category,
      taskConfig: config
    })
  }

  const compatibility = getIOCompatibility(parentCategory, !!isParentRoot, category)
  const parentOutput = isParentRoot ? 'url' : parentCategory ? TASK_IO_MAP[parentCategory].output : null
  const currentInput = category ? TASK_IO_MAP[category].input : null

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 헤더 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={600}>노드 속성</Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* 스크롤 영역 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Stack spacing={3}>
          {/* 이름 */}
          <TextField
            fullWidth
            size="small"
            label="노드 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* IO 호환성 표시 */}
          {parentOutput && (
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                데이터 흐름
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={`← ${IO_TYPE_LABELS[parentOutput] || parentOutput}`}
                  size="small"
                  variant="outlined"
                />
                <Typography variant="body2">→</Typography>
                {currentInput ? (
                  <Chip
                    label={IO_TYPE_LABELS[currentInput] || currentInput}
                    size="small"
                    variant="outlined"
                  />
                ) : (
                  <Chip label="미설정" size="small" variant="outlined" color="default" />
                )}
                {compatibility === 'compatible' && (
                  <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                )}
                {compatibility === 'incompatible' && (
                  <WarningIcon color="warning" sx={{ fontSize: 18 }} />
                )}
                {compatibility === 'unknown' && (
                  <HelpOutlineIcon color="disabled" sx={{ fontSize: 18 }} />
                )}
              </Stack>
              {compatibility === 'incompatible' && (
                <Alert severity="warning" sx={{ mt: 1 }} variant="outlined">
                  입출력 타입이 일치하지 않습니다. 실행 시 자동 변환을 시도합니다.
                </Alert>
              )}
            </Box>
          )}

          <Divider />

          {/* 카테고리 선택 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Task 카테고리
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((cat) => (
                <Chip
                  key={cat}
                  label={CATEGORY_LABELS[cat]}
                  size="small"
                  color={category === cat ? CATEGORY_COLORS[cat] : 'default'}
                  variant={category === cat ? 'filled' : 'outlined'}
                  onClick={() => handleCategoryChange(cat)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>

          {/* 카테고리별 Config 폼 */}
          {category && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  설정
                </Typography>

                {category === 'string_filter' && (
                  <StringFilterConfig
                    config={config}
                    filters={filters}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'page_navigation' && (
                  <PageNavigationConfig
                    config={config}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'string_extraction' && (
                  <StringExtractionConfig
                    config={config}
                    filters={filters}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'resource_extraction' && (
                  <ResourceExtractionConfig
                    config={config}
                    filters={filters}
                    onChange={handleConfigChange}
                  />
                )}
              </Box>
            </>
          )}
        </Stack>
      </Box>

      {/* 하단 적용 버튼 */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleApply}
          disabled={!name.trim() || !category}
        >
          적용
        </Button>
      </Box>
    </Box>
  )
}

// ---- 카테고리별 Config 폼 컴포넌트 ----

interface ConfigProps {
  config: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  filters?: Filter[]
}

function FilterDropdown({ label, value, filters, onChange }: {
  label: string
  value: string
  filters: Filter[]
  onChange: (value: string) => void
}) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ''}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="">
          <em>없음</em>
        </MenuItem>
        {filters.map((f) => (
          <MenuItem key={f.id} value={f.id}>
            {f.name} ({f.mode === 'whitelist' ? '화이트' : '블랙'})
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function StringFilterConfig({ config, filters = [], onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <FilterDropdown
        label="사전 필터"
        value={(config.preFilterId as string) || ''}
        filters={filters}
        onChange={(v) => onChange('preFilterId', v)}
      />
      <FilterDropdown
        label="사후 필터"
        value={(config.postFilterId as string) || ''}
        filters={filters}
        onChange={(v) => onChange('postFilterId', v)}
      />
      <TextField
        fullWidth
        size="small"
        label="Limit (-1 = 무제한)"
        type="number"
        value={config.limit ?? -1}
        onChange={(e) => onChange('limit', parseInt(e.target.value) || -1)}
      />
    </Stack>
  )
}

function PageNavigationConfig({ config, onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <FormControl fullWidth size="small">
        <InputLabel>대기 조건</InputLabel>
        <Select
          value={(config.waitUntil as string) || 'domcontentloaded'}
          label="대기 조건"
          onChange={(e) => onChange('waitUntil', e.target.value)}
        >
          <MenuItem value="domcontentloaded">DOM Content Loaded</MenuItem>
          <MenuItem value="load">Full Load</MenuItem>
          <MenuItem value="networkidle">Network Idle</MenuItem>
        </Select>
      </FormControl>
      <TextField
        fullWidth
        size="small"
        label="Timeout (ms)"
        type="number"
        value={config.timeout ?? 30000}
        onChange={(e) => onChange('timeout', parseInt(e.target.value) || 30000)}
      />
      <FormControlLabel
        control={
          <Switch
            checked={!!config.handleCookies}
            onChange={(e) => onChange('handleCookies', e.target.checked)}
          />
        }
        label="쿠키 자동 처리"
      />
    </Stack>
  )
}

function StringExtractionConfig({ config, filters = [], onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={!!config.includeHrefLinks}
            onChange={(e) => onChange('includeHrefLinks', e.target.checked)}
          />
        }
        label="href 링크 추출"
      />
      <FormControlLabel
        control={
          <Switch
            checked={!!config.includeTextUrls}
            onChange={(e) => onChange('includeTextUrls', e.target.checked)}
          />
        }
        label="본문 텍스트 URL 추출"
      />
      <FormControlLabel
        control={
          <Switch
            checked={!!config.includeAbsolutePaths}
            onChange={(e) => onChange('includeAbsolutePaths', e.target.checked)}
          />
        }
        label="절대경로 포함"
      />
      <FormControlLabel
        control={
          <Switch
            checked={!!config.includeRelativePaths}
            onChange={(e) => onChange('includeRelativePaths', e.target.checked)}
          />
        }
        label="상대경로 포함"
      />
      <FilterDropdown
        label="추출 후 필터"
        value={(config.postFilterId as string) || ''}
        filters={filters}
        onChange={(v) => onChange('postFilterId', v)}
      />
    </Stack>
  )
}

const RESOURCE_TYPES = [
  { value: 'image', label: '이미지' },
  { value: 'pdf', label: 'PDF' },
  { value: 'video', label: '비디오' },
  { value: 'css', label: 'CSS' },
  { value: 'js', label: 'JS' }
] as const

function ResourceExtractionConfig({ config, filters = [], onChange }: ConfigProps) {
  const selected = (config.resourceTypes as string[]) || []

  const toggleType = (type: string) => {
    if (selected.includes(type)) {
      onChange('resourceTypes', selected.filter(t => t !== type))
    } else {
      onChange('resourceTypes', [...selected, type])
    }
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
          리소스 타입
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {RESOURCE_TYPES.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              size="small"
              color={selected.includes(value) ? 'primary' : 'default'}
              variant={selected.includes(value) ? 'filled' : 'outlined'}
              onClick={() => toggleType(value)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
      </Box>
      <FilterDropdown
        label="필터"
        value={(config.filterId as string) || ''}
        filters={filters}
        onChange={(v) => onChange('filterId', v)}
      />
    </Stack>
  )
}
