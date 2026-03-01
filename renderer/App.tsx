import { useState, useEffect } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Tabs,
  Tab,
  Box,
  Container,
  CssBaseline,
  ThemeProvider
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import BuildIcon from '@mui/icons-material/Build'
import BugReportIcon from '@mui/icons-material/BugReport'
import TaskIcon from '@mui/icons-material/Task'
import AccountTreeIcon from '@mui/icons-material/AccountTree'

import TitleBar from './components/TitleBar'
import CrawlingPage from './pages/CrawlingPage'
import CrawlTaskPage from './pages/CrawlTaskPage'
import PipelinePage from './pages/PipelinePage'
import PipelineEditorPage from './pages/PipelineEditorPage'
import SettingsPage from './pages/SettingsPage'

import type { CrawlOptions } from './types'
import { storageService } from './services/storageService'
import { theme } from './styles'

function App() {
  // 모드 상태 (크롤링 vs 파이프라인 설정)
  const [mode, setMode] = useState<'crawling' | 'pipeline-config'>('crawling')
  const [pipelineConfigTab, setPipelineConfigTab] = useState(0) // 0: 태스크, 1: 파이프라인

  // 옵션 및 설정 상태
  const [showSettings, setShowSettings] = useState(false)
  const [options, setOptions] = useState<CrawlOptions>({
    includeAbsolutePaths: true,
    includeRelativePaths: true,
    domainSettings: {}
  })

  // 저장소 상태
  const [storagePath, setStoragePath] = useState('')
  const [isStorageActive, setIsStorageActive] = useState(false)

  // 저장 경로 변경 핸들러
  const handleStoragePathChange = async (path: string) => {
    setStoragePath(path)
    if (path && path.trim() !== '') {
      await storageService.setPath(path)
    }
  }

  // 파이프라인 편집 상태
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null)
  const [showPipelineEditor, setShowPipelineEditor] = useState(false)
  const [pipelineRefreshKey, setPipelineRefreshKey] = useState(0)

  const handleEditPipeline = (pipelineId: string | null) => {
    setEditingPipelineId(pipelineId)
    setShowPipelineEditor(true)
  }

  const handleClosePipelineEditor = () => {
    setShowPipelineEditor(false)
    setEditingPipelineId(null)
    setPipelineRefreshKey(prev => prev + 1)
  }

  // 저장된 경로 자동 로드
  useEffect(() => {
    const loadSavedPath = async () => {
      const savedPath = await storageService.getSavedPath()

      // 빈 문자열이 아닌 경우에만 설정
      if (savedPath && savedPath.trim() !== '') {
        setStoragePath(savedPath)
        await storageService.setPath(savedPath)
      }
    }

    void loadSavedPath()
  }, [])

  // 저장소 상태 확인
  useEffect(() => {
    const checkStorageStatus = async () => {
      const active = await storageService.isActive()
      setIsStorageActive(active)
    }

    void checkStorageStatus()
  }, [storagePath])

  // 파이프라인 편집 화면
  if (showPipelineEditor) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <TitleBar />
        <PipelineEditorPage
          pipelineId={editingPipelineId}
          onClose={handleClosePipelineEditor}
        />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <TitleBar />
        {/* 헤더 */}
        <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar variant="dense">
            <Typography variant="body1" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
              SiteCrawl
            </Typography>
            <Button
              color="inherit"
              startIcon={mode === 'crawling' ? <BuildIcon /> : <BugReportIcon />}
              onClick={() => setMode(mode === 'crawling' ? 'pipeline-config' : 'crawling')}
              sx={{ mr: 1 }}
            >
              {mode === 'crawling' ? '파이프라인 설정' : '크롤링'}
            </Button>
            <Button
              color="inherit"
              startIcon={<SettingsIcon />}
              onClick={() => setShowSettings(true)}
            >
              옵션
            </Button>
          </Toolbar>
        </AppBar>

        {/* 메인 컨텐츠 */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {mode === 'crawling' ? (
            <Container maxWidth="lg" sx={{ py: 4 }}>
              <CrawlingPage options={options} isStorageActive={isStorageActive} />
            </Container>
          ) : (
            <Box>
              {/* 파이프라인 설정 탭 */}
              <Tabs
                value={pipelineConfigTab}
                onChange={(_, v) => setPipelineConfigTab(v)}
                sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
                centered
              >
                <Tab icon={<TaskIcon />} label="태스크" iconPosition="start" />
                <Tab icon={<AccountTreeIcon />} label="파이프라인" iconPosition="start" />
              </Tabs>

              {/* 탭 컨텐츠 */}
              <Container maxWidth="lg">
                {pipelineConfigTab === 0 && <CrawlTaskPage isStorageActive={isStorageActive} />}
                {pipelineConfigTab === 1 && (
                  <PipelinePage
                    isStorageActive={isStorageActive}
                    onEditPipeline={handleEditPipeline}
                    refreshKey={pipelineRefreshKey}
                  />
                )}
              </Container>
            </Box>
          )}
        </Box>

        {/* 설정 다이얼로그 */}
        <SettingsPage
          open={showSettings}
          onClose={() => setShowSettings(false)}
          options={options}
          onOptionsChange={setOptions}
          storagePath={storagePath}
          onStoragePathChange={handleStoragePathChange}
        />
      </Box>
    </ThemeProvider>
  )
}

export default App
