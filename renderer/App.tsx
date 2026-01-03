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
  ThemeProvider,
  createTheme
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import BuildIcon from '@mui/icons-material/Build'
import BugReportIcon from '@mui/icons-material/BugReport'
import LinkIcon from '@mui/icons-material/Link'
import WorkIcon from '@mui/icons-material/Work'
import AccountTreeIcon from '@mui/icons-material/AccountTree'

import CrawlingPage from './pages/CrawlingPage'
import CrawlTaskPage from './pages/CrawlTaskPage'
import ActionTaskPage from './pages/ActionTaskPage'
import PipelinePage from './pages/PipelinePage'
import PipelineEditorPage from './pages/PipelineEditorPage'
import SettingsPage from './pages/SettingsPage'

import type { CrawlOptions } from './types'
import { storageService } from './services/storageService'

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea'
    },
    secondary: {
      main: '#764ba2'
    }
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  }
})

function App() {
  // 모드 상태 (크롤링 vs 파이프라인 설정)
  const [mode, setMode] = useState<'crawling' | 'pipeline-config'>('crawling')
  const [pipelineConfigTab, setPipelineConfigTab] = useState(0) // 0: URL추출, 1: 작업, 2: 파이프라인

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
        {/* 헤더 */}
        <AppBar position="static" elevation={1}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
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
                <Tab icon={<LinkIcon />} label="URL추출 태스크" iconPosition="start" />
                <Tab icon={<WorkIcon />} label="작업 태스크" iconPosition="start" />
                <Tab icon={<AccountTreeIcon />} label="파이프라인" iconPosition="start" />
              </Tabs>

              {/* 탭 컨텐츠 */}
              <Container maxWidth="lg">
                {pipelineConfigTab === 0 && <CrawlTaskPage isStorageActive={isStorageActive} />}
                {pipelineConfigTab === 1 && <ActionTaskPage isStorageActive={isStorageActive} />}
                {pipelineConfigTab === 2 && (
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
          onStoragePathChange={setStoragePath}
        />
      </Box>
    </ThemeProvider>
  )
}

export default App
