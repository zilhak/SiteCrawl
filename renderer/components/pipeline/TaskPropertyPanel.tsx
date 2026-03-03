/**
 * Task 속성 편집 패널 (독립 컴포넌트)
 * 모든 변경이 즉시 적용됨 (로컬 상태 없음, 완전 제어 컴포넌트)
 */

import { useState } from 'react'
import {
  Box,
  Typography,
  TextField,
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
import AddIcon from '@mui/icons-material/Add'
import type { TaskCategory } from '../../types'
import { TASK_IO_MAP, CATEGORY_LABELS, CATEGORY_COLORS, IO_TYPE_LABELS } from '../../constants/taskIO'

export interface TaskPropertyData {
  taskName: string
  taskCategory?: TaskCategory
  taskConfig?: Record<string, unknown>
}

interface TaskPropertyPanelProps {
  data: TaskPropertyData
  parentCategory?: TaskCategory
  isParentRoot?: boolean
  isReadOnly?: boolean
  onUpdate: (updates: Partial<TaskPropertyData>) => void
  onClose: () => void
}

// 카테고리별 기본 config
function getDefaultConfig(category: TaskCategory): Record<string, unknown> {
  switch (category) {
    case 'string_filter':
      return { mode: 'whitelist', regex: '', wildcards: [], limit: -1 }
    case 'page_navigation':
      return { waitUntil: 'domcontentloaded', timeout: 30000, handleCookies: true }
    case 'link_extraction':
      return {
        includeHrefLinks: true, includeTextUrls: true,
        includeAbsolutePaths: true, includeRelativePaths: true,
        postFilterMode: '', postFilterRegex: '', postFilterWildcards: []
      }
    case 'resource_extraction':
      return {
        resourceTypes: ['image'],
        filterMode: '', filterRegex: '', filterWildcards: []
      }
    case 'string_db_save':
      return { deduplication: false }
  }
}

// IO 호환성 체크 (urls → strings 단방향 상속)
function isIOCompatible(output: string, input: string): boolean {
  if (output === input) return true
  if (output === 'urls' && input === 'strings') return true
  if (output === 'url' && (input === 'strings' || input === 'urls')) return true
  return false
}

function getIOCompatibility(
  parentCategory: TaskCategory | undefined,
  isParentRoot: boolean,
  currentCategory: TaskCategory | undefined
): 'compatible' | 'incompatible' | 'unknown' {
  if (!currentCategory) return 'unknown'

  const parentOutput = isParentRoot ? 'page' : parentCategory ? TASK_IO_MAP[parentCategory].output : null
  if (!parentOutput) return 'unknown'

  const currentInput = TASK_IO_MAP[currentCategory].input
  return isIOCompatible(parentOutput, currentInput) ? 'compatible' : 'incompatible'
}

export default function TaskPropertyPanel({
  data,
  parentCategory,
  isParentRoot,
  isReadOnly,
  onUpdate,
  onClose
}: TaskPropertyPanelProps) {
  // 로컬 상태 없음 - props에서 직접 읽고, 변경 시 즉시 onUpdate 호출
  const category = data.taskCategory
  const config = data.taskConfig || (category ? getDefaultConfig(category) : {})

  const handleNameChange = (newName: string) => {
    onUpdate({ taskName: newName })
  }

  const handleCategoryChange = (newCategory: TaskCategory) => {
    onUpdate({
      taskCategory: newCategory,
      taskConfig: getDefaultConfig(newCategory)
    })
  }

  const handleConfigChange = (key: string, value: unknown) => {
    onUpdate({
      taskConfig: { ...config, [key]: value }
    })
  }

  const compatibility = getIOCompatibility(parentCategory, !!isParentRoot, category)
  const parentOutput = isParentRoot ? 'page' : parentCategory ? TASK_IO_MAP[parentCategory].output : null
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
        {isReadOnly ? (
          <Stack spacing={2}>
            <Alert severity="info" variant="outlined">
              _run_ 노드는 파이프라인 진입점으로, 페이지 이동 Task로 고정되어 있습니다.
            </Alert>
            <TextField
              fullWidth
              size="small"
              label="노드 이름"
              value={data.taskName}
              disabled
            />
            <Chip
              label={CATEGORY_LABELS[data.taskCategory!]}
              size="small"
              color={CATEGORY_COLORS[data.taskCategory!]}
            />
          </Stack>
        ) : (
        <Stack spacing={3}>
          {/* 이름 */}
          <TextField
            fullWidth
            size="small"
            label="노드 이름"
            value={data.taskName}
            onChange={(e) => handleNameChange(e.target.value)}
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
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'page_navigation' && (
                  <PageNavigationConfig
                    config={config}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'link_extraction' && (
                  <LinkExtractionConfig
                    config={config}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'resource_extraction' && (
                  <ResourceExtractionConfig
                    config={config}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'string_db_save' && (
                  <StringDbSaveConfigForm
                    config={config}
                    onChange={handleConfigChange}
                  />
                )}
              </Box>
            </>
          )}
        </Stack>
        )}
      </Box>
    </Box>
  )
}

// ---- 카테고리별 Config 폼 컴포넌트 ----

interface ConfigProps {
  config: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

// 인라인 필터 설정 컴포넌트 (Filter 엔티티 대체)
function InlineFilterConfig({ modeKey, regexKey, wildcardsKey, config, onChange }: {
  modeKey: string
  regexKey: string
  wildcardsKey: string
  config: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}) {
  const mode = (config[modeKey] as string) || ''
  const regex = (config[regexKey] as string) || ''
  const wildcards = (config[wildcardsKey] as string[]) || []
  const [newWildcard, setNewWildcard] = useState('')

  const addWildcard = () => {
    if (newWildcard.trim()) {
      onChange(wildcardsKey, [...wildcards, newWildcard.trim()])
      setNewWildcard('')
    }
  }

  const removeWildcard = (index: number) => {
    onChange(wildcardsKey, wildcards.filter((_, i) => i !== index))
  }

  return (
    <Stack spacing={2}>
      <FormControl fullWidth size="small">
        <InputLabel>필터 모드</InputLabel>
        <Select
          value={mode}
          label="필터 모드"
          onChange={(e) => onChange(modeKey, e.target.value)}
        >
          <MenuItem value="">
            <em>사용 안 함</em>
          </MenuItem>
          <MenuItem value="whitelist">화이트리스트 (일치만 포함)</MenuItem>
          <MenuItem value="blacklist">블랙리스트 (일치 제외)</MenuItem>
        </Select>
      </FormControl>

      {mode && (
        <>
          <TextField
            fullWidth
            size="small"
            label="정규표현식"
            placeholder="예: https?://example\\.com/.*"
            value={regex}
            onChange={(e) => onChange(regexKey, e.target.value)}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              와일드카드 패턴
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                placeholder="예: *.jpg"
                value={newWildcard}
                onChange={(e) => setNewWildcard(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWildcard() } }}
                sx={{ flex: 1 }}
              />
              <IconButton size="small" onClick={addWildcard} disabled={!newWildcard.trim()}>
                <AddIcon />
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {wildcards.map((w, i) => (
                <Chip
                  key={i}
                  label={w}
                  size="small"
                  onDelete={() => removeWildcard(i)}
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  )
}

function StringFilterConfig({ config, onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <InlineFilterConfig
        modeKey="mode"
        regexKey="regex"
        wildcardsKey="wildcards"
        config={config}
        onChange={onChange}
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

function LinkExtractionConfig({ config, onChange }: ConfigProps) {
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
      <Divider />
      <Typography variant="caption" color="text.secondary">
        추출 후 필터 (선택)
      </Typography>
      <InlineFilterConfig
        modeKey="postFilterMode"
        regexKey="postFilterRegex"
        wildcardsKey="postFilterWildcards"
        config={config}
        onChange={onChange}
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

function StringDbSaveConfigForm({ config, onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={!!config.deduplication}
            onChange={(e) => onChange('deduplication', e.target.checked)}
          />
        }
        label="중복 제거 (이미 저장된 문자열 건너뛰기)"
      />
    </Stack>
  )
}

function ResourceExtractionConfig({ config, onChange }: ConfigProps) {
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
      <Divider />
      <Typography variant="caption" color="text.secondary">
        결과 필터 (선택)
      </Typography>
      <InlineFilterConfig
        modeKey="filterMode"
        regexKey="filterRegex"
        wildcardsKey="filterWildcards"
        config={config}
        onChange={onChange}
      />
    </Stack>
  )
}
