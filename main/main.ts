import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { Crawler } from './crawler'
import type { CrawlOptions, LoginOptions } from './crawler'
import { HistoryDatabase } from './database'
import { PipelineDatabase, PipelineManager } from './pipeline'
import type { Pipeline, PipelineTask } from './pipeline/types'
import { PipelineExecutionEngine } from './pipeline/execution'
import { TaskDatabase, TaskManager } from './task'
import type { CreateTaskDTO, TaskCategory } from './task/types'
import { appConfig } from './config'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
const historyDB = new HistoryDatabase()
let pipelineDB: PipelineDatabase | null = null
let pipelineManager: PipelineManager | null = null
let taskDB: TaskDatabase | null = null
let taskManager: TaskManager | null = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1000,
    minHeight: 700,
    center: true,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (isDev) {
    // 개발 서버로부터 로딩
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // 빌드된 정적 파일 로딩
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // IPC 핸들러 등록
  setupIpcHandlers(mainWindow)
}

const setupIpcHandlers = (window: BrowserWindow) => {
  // 창 제어
  ipcMain.handle('window:minimize', () => window.minimize())
  ipcMain.handle('window:maximize', () => {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
    return window.isMaximized()
  })
  ipcMain.handle('window:close', () => window.close())
  ipcMain.handle('window:is-maximized', () => window.isMaximized())

  // 최대화 상태 변경 시 렌더러에 알림
  window.on('maximize', () => window.webContents.send('window:maximized-changed', true))
  window.on('unmaximize', () => window.webContents.send('window:maximized-changed', false))

  // 크롤링 시작
  ipcMain.handle('crawler:start', async (_event, url: string, useSession: boolean = false, options?: unknown) => {
    try {
      const crawler = new Crawler(window)
      const result = await crawler.start(url, useSession, options as CrawlOptions)

      // 히스토리 저장 (데이터베이스가 활성화된 경우)
      if (historyDB.isActive()) {
        historyDB.saveHistory({
          url: result.url,
          title: result.title,
          description: result.description,
          linkCount: result.links.length,
          timestamp: result.timestamp
        })
      }

      window.webContents.send('crawler:complete', result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('crawler:error', errorMessage)
      throw error
    }
  })

  // 자동 로그인
  ipcMain.handle('crawler:login', async (_event, options: unknown) => {
    try {
      const crawler = new Crawler(window)
      await crawler.login(options as LoginOptions)
      window.webContents.send('crawler:login-complete')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('crawler:error', errorMessage)
      throw error
    }
  })

  // 수동 로그인
  ipcMain.handle('crawler:manual-login', async (_event, url: string) => {
    try {
      const crawler = new Crawler(window)
      await crawler.manualLogin(url)
      window.webContents.send('crawler:login-complete')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('crawler:error', errorMessage)
      throw error
    }
  })

  // 저장된 세션 목록 조회
  ipcMain.handle('crawler:get-sessions', async () => {
    try {
      const crawler = new Crawler(window)
      return await crawler.getSavedSessions()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`세션 조회 실패: ${errorMessage}`)
    }
  })

  // 세션 삭제
  ipcMain.handle('crawler:delete-session', async (_event, hostname: string) => {
    try {
      const crawler = new Crawler(window)
      await crawler.deleteSession(hostname)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`세션 삭제 실패: ${errorMessage}`)
    }
  })

  // 저장 경로 선택 대화상자
  ipcMain.handle('storage:select-path', async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'createDirectory'],
      title: '저장 데이터 경로 선택'
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]

      // 이미 같은 경로로 활성화되어 있지 않으면 초기화
      if (!historyDB.isActive() || !pipelineManager || !taskManager) {
        historyDB.setDatabasePath(selectedPath)

        // Pipeline & Task 데이터베이스 초기화
        const db = historyDB.getDatabase()
        if (db) {
          pipelineDB = new PipelineDatabase(db)
          pipelineManager = new PipelineManager(pipelineDB)

          taskDB = new TaskDatabase(db)
          taskManager = new TaskManager(taskDB)
        }
      }

      return selectedPath
    }

    return null
  })

  // 저장 경로 설정
  ipcMain.handle('storage:set-path', async (_event, storagePath: string) => {
    try {
      // 이미 같은 경로로 활성화되어 있으면 중복 초기화 방지
      if (historyDB.isActive() && pipelineManager && taskManager) {
        appConfig.set('storagePath', storagePath)
        return true
      }

      historyDB.setDatabasePath(storagePath)

      // Pipeline & Task 데이터베이스 초기화
      const db = historyDB.getDatabase()
      if (db) {
        pipelineDB = new PipelineDatabase(db)
        pipelineManager = new PipelineManager(pipelineDB)

        taskDB = new TaskDatabase(db)
        taskManager = new TaskManager(taskDB)
      }

      // 경로 저장
      appConfig.set('storagePath', storagePath)

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`저장 경로 설정 실패: ${errorMessage}`)
    }
  })

  // 저장된 경로 조회
  ipcMain.handle('storage:get-saved-path', async () => {
    return appConfig.get('storagePath')
  })

  // 저장소 활성화 여부 확인
  ipcMain.handle('storage:is-active', async () => {
    return historyDB.isActive()
  })

  // 히스토리 조회
  ipcMain.handle('history:get-all', async () => {
    return historyDB.getAllHistory()
  })

  // 최근 히스토리 조회
  ipcMain.handle('history:get-recent', async (_event, limit: number = 10) => {
    return historyDB.getRecentHistory(limit)
  })

  // URL로 히스토리 검색
  ipcMain.handle('history:search', async (_event, url: string) => {
    return historyDB.getHistoryByUrl(url)
  })

  // 히스토리 삭제
  ipcMain.handle('history:delete', async (_event, id: number) => {
    return historyDB.deleteHistory(id)
  })

  // 모든 히스토리 삭제
  ipcMain.handle('history:clear', async () => {
    return historyDB.clearAllHistory()
  })

  // Pipeline CRUD
  ipcMain.handle('pipeline:create', async (_event, name: string, description?: string) => {
    if (!pipelineManager) {
      throw new Error('저장소가 설정되지 않았습니다. 먼저 저장 경로를 설정해주세요.')
    }
    return pipelineManager.createPipeline(name, description)
  })

  ipcMain.handle('pipeline:save', async (_event, pipeline: unknown) => {
    if (!pipelineManager) {
      throw new Error('저장소가 설정되지 않았습니다.')
    }
    return pipelineManager.savePipeline(pipeline as Pipeline)
  })

  ipcMain.handle('pipeline:get', async (_event, id: string) => {
    if (!pipelineManager) return null
    return pipelineManager.getPipeline(id)
  })

  ipcMain.handle('pipeline:get-all', async () => {
    if (!pipelineManager) return []
    return pipelineManager.getAllPipelines()
  })

  ipcMain.handle('pipeline:search', async (_event, query: string) => {
    if (!pipelineManager) return []
    return pipelineManager.searchPipelines(query)
  })

  ipcMain.handle('pipeline:delete', async (_event, id: string) => {
    if (!pipelineManager) return false
    return pipelineManager.deletePipeline(id)
  })

  // Task Management
  ipcMain.handle('pipeline:add-task', async (_event, pipelineId: string, task: unknown) => {
    if (!pipelineManager) {
      throw new Error('저장소가 설정되지 않았습니다.')
    }
    return pipelineManager.addTask(pipelineId, task as PipelineTask)
  })

  ipcMain.handle('pipeline:remove-task', async (_event, pipelineId: string, taskName: string) => {
    if (!pipelineManager) {
      throw new Error('저장소가 설정되지 않았습니다.')
    }
    return pipelineManager.removeTask(pipelineId, taskName)
  })

  ipcMain.handle('pipeline:update-task', async (_event, pipelineId: string, taskName: string, updates: unknown) => {
    if (!pipelineManager) {
      throw new Error('저장소가 설정되지 않았습니다.')
    }
    return pipelineManager.updateTask(pipelineId, taskName, updates as Partial<PipelineTask>)
  })

  // Validation & Info
  ipcMain.handle('pipeline:validate', async (_event, pipelineId: string) => {
    if (!pipelineManager) {
      return { valid: false, errors: ['저장소가 설정되지 않았습니다.'], warnings: [] }
    }
    return pipelineManager.validatePipeline(pipelineId)
  })

  ipcMain.handle('pipeline:get-stats', async (_event, pipelineId: string) => {
    if (!pipelineManager) return null
    return pipelineManager.getPipelineStats(pipelineId)
  })

  ipcMain.handle('pipeline:clone', async (_event, pipelineId: string, newName?: string) => {
    if (!pipelineManager) return null
    return pipelineManager.clonePipeline(pipelineId, newName)
  })

  // Task CRUD (통합)
  ipcMain.handle('task:create', async (_event, dto: unknown) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.createTask(dto as CreateTaskDTO)
  })

  ipcMain.handle('task:update', async (_event, id: string, updates: unknown) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.updateTask(id, updates as Partial<CreateTaskDTO>)
  })

  ipcMain.handle('task:get', async (_event, id: string) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.getTask(id)
  })

  ipcMain.handle('task:get-all', async () => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.getAllTasks()
  })

  ipcMain.handle('task:get-by-category', async (_event, category: string) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.getTasksByCategory(category as TaskCategory)
  })

  ipcMain.handle('task:search', async (_event, query: string) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.searchTasks(query)
  })

  ipcMain.handle('task:delete', async (_event, id: string) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.deleteTask(id)
  })

  ipcMain.handle('task:delete-multiple', async (_event, ids: string[]) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.deleteTasks(ids)
  })

  ipcMain.handle('task:create-quick', async (_event, category: string) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.createQuickTask(category as TaskCategory)
  })

  ipcMain.handle('task:get-paginated', async (_event, category: string, page: number, pageSize: number) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.getTasksPaginated(category as TaskCategory, page, pageSize)
  })

  ipcMain.handle('task:validate', async (_event, task: unknown) => {
    if (!taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return taskManager.validateTask(task as any)
  })

  // Pipeline 실행
  ipcMain.handle('pipeline:execute', async (_event, pipelineId: string, initialUrl: string) => {
    if (!pipelineManager || !taskManager) {
      throw new Error('저장소가 설정되지 않았습니다.')
    }

    const pipeline = pipelineManager.getPipeline(pipelineId)
    if (!pipeline) throw new Error('파이프라인을 찾을 수 없습니다.')

    const executionId = randomUUID()

    // 실행 기록 저장 (시작)
    if (pipelineDB) {
      pipelineDB.saveExecution({
        id: executionId,
        pipelineId,
        initialUrl,
        status: 'running',
        startedAt: Date.now()
      })
    }

    const engine = new PipelineExecutionEngine({
      onProgress: (event) => {
        window.webContents.send('pipeline:execution-progress', event)
      }
    })

    try {
      const result = await engine.execute(pipeline, initialUrl, executionId)

      // 실행 기록 업데이트
      if (pipelineDB) {
        pipelineDB.saveExecution({
          id: executionId,
          pipelineId,
          initialUrl,
          status: result.status,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          error: result.error
        })
      }

      window.webContents.send('pipeline:execution-complete', result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (pipelineDB) {
        pipelineDB.saveExecution({
          id: executionId,
          pipelineId,
          initialUrl,
          status: 'failed',
          startedAt: Date.now(),
          completedAt: Date.now(),
          error: errorMessage
        })
      }

      window.webContents.send('pipeline:execution-error', errorMessage)
      throw error
    }
  })
}

app.whenReady().then(() => {
  // 저장된 경로가 있으면 자동으로 로드
  const savedPath = appConfig.get('storagePath')

  if (savedPath) {
    historyDB.setDatabasePath(savedPath)

    // Pipeline & Task 데이터베이스 초기화
    const db = historyDB.getDatabase()
    if (db) {
      pipelineDB = new PipelineDatabase(db)
      pipelineManager = new PipelineManager(pipelineDB)

      taskDB = new TaskDatabase(db)
      taskManager = new TaskManager(taskDB)
    }
  }

  createWindow()
})

app.on('window-all-closed', () => {
  historyDB.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
