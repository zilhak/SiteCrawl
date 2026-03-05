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
  isFinalRoot?: boolean
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
    case 'string_display':
      return { label: '' }
    case 'result_save':
      return { targetIndex: -1 }
    case 'page_db_check':
      return { passCondition: 'not_exists' }
    case 'page_db_save':
      return {}
  }
}

// IO 호환성 체크 (엔진의 adaptInput이 지원하는 모든 변환 포함)
function isIOCompatible(output: string, input: string): boolean {
  if (output === input) return true
  // urls ↔ strings: 상호 변환 가능
  if (output === 'urls' && input === 'strings') return true
  if (output === 'strings' && input === 'urls') return true
  // url → 배열 타입
  if (output === 'url' && (input === 'strings' || input === 'urls')) return true
  // 배열 타입 → url (첫 번째 요소 사용)
  if ((output === 'urls' || output === 'strings') && input === 'url') return true
  // empty → page 제외 모두 (Final 구간)
  if (output === 'empty' && input !== 'page') return true
  return false
}

// 부모 출력에 맞는 호환 카테고리 목록 반환
function getCompatibleCategories(parentOutput: string): TaskCategory[] {
  return (Object.keys(TASK_IO_MAP) as TaskCategory[]).filter(cat => {
    const catIO = TASK_IO_MAP[cat]
    if (catIO.output === 'none') {
      // 터미널 노드 (result_save)도 입력이 맞으면 선택 가능
    }
    return isIOCompatible(parentOutput, catIO.input)
  })
}

// 부모 출력 타입 계산
function getParentOutputType(
  parentCategory: TaskCategory | undefined,
  isParentRoot: boolean,
  isFinalRoot?: boolean
): string | null {
  if (isParentRoot) {
    return isFinalRoot ? 'empty' : 'page'
  }
  if (parentCategory) {
    return TASK_IO_MAP[parentCategory].output
  }
  return null
}

export default function TaskPropertyPanel({
  data,
  parentCategory,
  isParentRoot,
  isFinalRoot,
  isReadOnly,
  onUpdate,
  onClose
}: TaskPropertyPanelProps) {
  // 로컬 상태 없음 - props에서 직접 읽고, 변경 시 즉시 onUpdate 호출
  const category = data.taskCategory
  const config = data.taskConfig || (category ? getDefaultConfig(category) : {})

  // 부모 출력 타입 → 호환 카테고리 필터링
  const parentOutput = getParentOutputType(parentCategory, !!isParentRoot, isFinalRoot)
  const compatibleCategories = parentOutput ? getCompatibleCategories(parentOutput) : Object.keys(TASK_IO_MAP) as TaskCategory[]

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
            <Alert severity={data.taskName === '_final_' ? 'warning' : 'info'} variant="outlined">
              {data.taskName === '_final_'
                ? '_final_ 노드는 Final 구간의 진입점입니다.'
                : '_run_ 노드는 파이프라인 진입점으로, 페이지 이동 Task로 고정되어 있습니다.'}
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

          {/* 데이터 흐름 표시 */}
          {parentOutput && (
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                부모 출력: {IO_TYPE_LABELS[parentOutput] || parentOutput}
              </Typography>
            </Box>
          )}

          <Divider />

          {/* 카테고리 선택 (부모 output에 맞는 것만 표시) */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Task 카테고리
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {compatibleCategories.map((cat) => (
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

                {category === 'string_display' && (
                  <StringDisplayConfigForm
                    config={config}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'result_save' && (
                  <ResultSaveConfigForm
                    config={config}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'page_db_check' && (
                  <PageDbCheckConfigForm
                    config={config}
                    onChange={handleConfigChange}
                  />
                )}

                {category === 'page_db_save' && (
                  <PageDbSaveConfigForm />
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

function ResultSourceSelect({ config, onChange }: ConfigProps) {
  const resultIndex = config.resultIndex as (number | 'all' | undefined)
  const selectValue = resultIndex === undefined ? 'none' : resultIndex === 'all' ? 'all' : 'index'

  return (
    <>
      <FormControl fullWidth size="small">
        <InputLabel>Result 소스</InputLabel>
        <Select
          value={selectValue}
          label="Result 소스"
          onChange={(e) => {
            const v = e.target.value
            if (v === 'none') onChange('resultIndex', undefined)
            else if (v === 'all') onChange('resultIndex', 'all')
            else onChange('resultIndex', 0)
          }}
        >
          <MenuItem value="none">없음 (트리 입력 사용)</MenuItem>
          <MenuItem value="index">Result 인덱스 지정</MenuItem>
          <MenuItem value="all">Result 전체</MenuItem>
        </Select>
      </FormControl>
      {typeof config.resultIndex === 'number' && (
        <TextField
          label="Result 인덱스"
          type="number"
          value={config.resultIndex}
          onChange={(e) => onChange('resultIndex', parseInt(e.target.value) || 0)}
          size="small"
          fullWidth
        />
      )}
    </>
  )
}

function StringDbSaveConfigForm({ config, onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <ResultSourceSelect config={config} onChange={onChange} />
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

function StringDisplayConfigForm({ config, onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <ResultSourceSelect config={config} onChange={onChange} />
      <TextField
        fullWidth
        size="small"
        label="표시 제목 (선택)"
        placeholder="예: 추출된 링크 목록"
        value={(config.label as string) || ''}
        onChange={(e) => onChange('label', e.target.value)}
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

function ResultSaveConfigForm({ config, onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <TextField
        label="Target Index"
        type="number"
        value={config.targetIndex ?? -1}
        onChange={(e) => onChange('targetIndex', parseInt(e.target.value) || -1)}
        helperText="-1: 마지막에 추가 (append), 0 이상: 해당 인덱스에 저장"
        size="small"
        fullWidth
      />
    </Stack>
  )
}

function PageDbCheckConfigForm({ config, onChange }: ConfigProps) {
  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined" sx={{ fontSize: '12px' }}>
        페이지 URL의 도메인별 방문 기록을 확인합니다.
        조건이 충족되면 페이지를 통과시키고, 아니면 하위 Task를 건너뜁니다.
      </Alert>
      <FormControl fullWidth size="small">
        <InputLabel>통과 조건</InputLabel>
        <Select
          value={(config.passCondition as string) || 'not_exists'}
          label="통과 조건"
          onChange={(e) => onChange('passCondition', e.target.value)}
        >
          <MenuItem value="not_exists">방문하지 않은 페이지만 통과</MenuItem>
          <MenuItem value="exists">방문했던 페이지만 통과</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  )
}

function PageDbSaveConfigForm() {
  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined" sx={{ fontSize: '12px' }}>
        현재 페이지의 URL을 도메인별 방문 기록 DB에 저장합니다.
        경로만 저장되며 (쿼리/해시 제외), 도메인별로 테이블이 자동 생성됩니다.
      </Alert>
    </Stack>
  )
}
