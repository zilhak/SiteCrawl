import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Box,
  Typography,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  Alert,
  IconButton,
  Stack,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import type { CrawlOptions, DomainFilter, DomainSettings } from '../types'
import { storageService } from '../services/storageService'

interface SettingsPageProps {
  open: boolean
  onClose: () => void
  options: CrawlOptions
  onOptionsChange: (options: CrawlOptions) => void
  storagePath: string
  onStoragePathChange: (path: string) => void
}

export default function SettingsPage({
  open,
  onClose,
  options,
  onOptionsChange,
  storagePath,
  onStoragePathChange
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [newPattern, setNewPattern] = useState('')

  const handleSelectPath = async () => {
    const path = await storageService.selectPath()
    if (path) {
      onStoragePathChange(path)
    }
  }

  const addDomain = () => {
    if (!newDomain.trim()) return
    const domain = newDomain.trim()
    if (options.domainSettings && options.domainSettings[domain]) {
      alert('이미 존재하는 도메인입니다')
      return
    }
    onOptionsChange({
      ...options,
      domainSettings: {
        ...(options.domainSettings || {}),
        [domain]: { mode: 'blacklist', patterns: [] }
      }
    })
    setSelectedDomain(domain)
    setNewDomain('')
  }

  const deleteDomain = (domain: string) => {
    const newSettings = { ...(options.domainSettings || {}) }
    delete newSettings[domain]
    onOptionsChange({ ...options, domainSettings: newSettings })
    if (selectedDomain === domain) {
      setSelectedDomain(null)
    }
  }

  const updateFilterMode = (mode: 'whitelist' | 'blacklist') => {
    if (!selectedDomain || !options.domainSettings) return
    onOptionsChange({
      ...options,
      domainSettings: {
        ...options.domainSettings,
        [selectedDomain]: {
          ...options.domainSettings[selectedDomain],
          mode
        }
      }
    })
  }

  const addPattern = () => {
    if (!selectedDomain || !newPattern.trim() || !options.domainSettings) return
    const pattern = newPattern.trim()
    const currentPatterns = options.domainSettings[selectedDomain].patterns
    if (currentPatterns.includes(pattern)) {
      alert('이미 존재하는 패턴입니다')
      return
    }
    onOptionsChange({
      ...options,
      domainSettings: {
        ...options.domainSettings,
        [selectedDomain]: {
          ...options.domainSettings[selectedDomain],
          patterns: [...currentPatterns, pattern]
        }
      }
    })
    setNewPattern('')
  }

  const deletePattern = (pattern: string) => {
    if (!selectedDomain || !options.domainSettings) return
    onOptionsChange({
      ...options,
      domainSettings: {
        ...options.domainSettings,
        [selectedDomain]: {
          ...options.domainSettings[selectedDomain],
          patterns: options.domainSettings[selectedDomain].patterns.filter(p => p !== pattern)
        }
      }
    })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">크롤링 옵션</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tab label="일반" />
        <Tab label="경로" />
        <Tab label="도메인" />
      </Tabs>

      <DialogContent sx={{ minHeight: 400 }}>
        {/* 일반 탭 */}
        {activeTab === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              저장 데이터 경로
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              프로그램 데이터를 저장할 경로를 설정하세요
            </Typography>

            <Stack spacing={2} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  value={storagePath}
                  placeholder="경로가 설정되지 않음"
                  InputProps={{ readOnly: true }}
                  size="small"
                />
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={handleSelectPath}
                  sx={{ width: '150px' }}
                >
                  경로 선택
                </Button>
              </Stack>

              {storagePath ? (
                <Alert severity="success">저장소가 활성화되었습니다</Alert>
              ) : (
                <Alert severity="warning">
                  경로를 설정하지 않으면 데이터가 저장되지 않습니다
                </Alert>
              )}

              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  저장 정보
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>크롤링 히스토리, Task, Pipeline 등의 데이터가 저장됩니다</li>
                  <li>저장된 데이터는 SQLite 데이터베이스로 관리됩니다</li>
                  <li>경로를 설정하지 않아도 크롤링 기능은 정상 작동합니다</li>
                </ul>
              </Alert>
            </Stack>
          </Box>
        )}

        {/* 경로 탭 */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              링크 추출 설정
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              추출할 링크의 경로 유형을 선택하세요
            </Typography>

            <Stack spacing={2} sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeAbsolutePaths || false}
                    onChange={(e) => onOptionsChange({
                      ...options,
                      includeAbsolutePaths: e.target.checked
                    })}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>절대 경로 포함</Typography>
                    <Typography variant="body2" color="text.secondary">
                      다른 도메인으로 이동하는 링크 (외부 링크)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="code">
                      예: https://google.com, https://github.com
                    </Typography>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeRelativePaths || false}
                    onChange={(e) => onOptionsChange({
                      ...options,
                      includeRelativePaths: e.target.checked
                    })}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>상대 경로 포함</Typography>
                    <Typography variant="body2" color="text.secondary">
                      같은 도메인 내부의 링크 (내부 링크)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="code">
                      예: /about, /contact, ./page.html
                    </Typography>
                  </Box>
                }
              />

              {!options.includeAbsolutePaths && !options.includeRelativePaths && (
                <Alert severity="warning">
                  최소 하나의 경로 유형을 선택해야 합니다
                </Alert>
              )}

              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>팁</Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li><strong>절대 경로만</strong>: 외부 링크만 수집 (SEO 분석, 백링크 확인)</li>
                  <li><strong>상대 경로만</strong>: 내부 페이지만 수집 (사이트맵 생성)</li>
                  <li><strong>둘 다 선택</strong>: 모든 링크 수집 (전체 링크 분석)</li>
                </ul>
              </Alert>
            </Stack>
          </Box>
        )}

        {/* 도메인 탭 */}
        {activeTab === 2 && (
          <Stack direction="row" spacing={2}>
            {/* 좌측: 도메인 목록 */}
            <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                도메인 목록
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="예: example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addDomain()}
                />
                <IconButton color="primary" onClick={addDomain}>
                  <AddIcon />
                </IconButton>
              </Stack>

              {!options.domainSettings || Object.keys(options.domainSettings).length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    설정된 도메인이 없습니다
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    도메인을 추가하여 필터링 규칙을 설정하세요
                  </Typography>
                </Box>
              ) : (
                <List>
                  {Object.keys(options.domainSettings).map((domain) => (
                    <ListItem
                      key={domain}
                      onClick={() => setSelectedDomain(domain)}
                    >
                      <ListItemText
                        primary={domain}
                        secondary={
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            <Chip
                              label={options.domainSettings![domain].mode === 'whitelist' ? '화이트리스트' : '블랙리스트'}
                              size="small"
                              color={options.domainSettings![domain].mode === 'whitelist' ? 'success' : 'error'}
                            />
                            <Chip
                              label={`${options.domainSettings![domain].patterns.length}개 패턴`}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => deleteDomain(domain)} size="small">
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>

            {/* 우측: 설정 패널 */}
            <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
              {selectedDomain && options.domainSettings ? (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    🌐 {selectedDomain} 설정
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" gutterBottom>
                    필터 모드
                  </Typography>
                  <RadioGroup
                    value={options.domainSettings[selectedDomain].mode}
                    onChange={(e) => updateFilterMode(e.target.value as 'whitelist' | 'blacklist')}
                  >
                    <FormControlLabel
                      value="blacklist"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>🚫 블랙리스트</Typography>
                          <Typography variant="caption" color="text.secondary">
                            패턴에 해당하는 링크를 제외합니다
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="whitelist"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>✅ 화이트리스트</Typography>
                          <Typography variant="caption" color="text.secondary">
                            패턴에 해당하는 링크만 포함합니다
                          </Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" gutterBottom>
                    URL 패턴
                  </Typography>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    와일드카드(*) 사용 가능: */products/*, */blog/*
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ my: 2 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="예: */products/*, */category/*"
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addPattern()}
                    />
                    <Button variant="outlined" onClick={addPattern}>
                      추가
                    </Button>
                  </Stack>

                  {options.domainSettings[selectedDomain].patterns.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        패턴이 없습니다. 패턴을 추가하세요.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1}>
                      {options.domainSettings[selectedDomain].patterns.map((pattern, idx) => (
                        <Paper key={idx} variant="outlined" sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" component="code" fontFamily="monospace">
                            {pattern}
                          </Typography>
                          <IconButton size="small" onClick={() => deletePattern(pattern)}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Paper>
                      ))}
                    </Stack>
                  )}

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="caption" gutterBottom><strong>사용 예시:</strong></Typography>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: '12px' }}>
                      <li><code>*/products/*</code> - products 경로가 포함된 모든 URL</li>
                      <li><code>*/blog/2024/*</code> - 2024년 블로그 포스트</li>
                      <li><code>*.pdf</code> - PDF 파일 링크</li>
                    </ul>
                  </Alert>
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    좌측에서 도메인을 선택하세요
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    도메인별로 링크 필터링 규칙을 설정할 수 있습니다
                  </Typography>
                </Box>
              )}
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  )
}
