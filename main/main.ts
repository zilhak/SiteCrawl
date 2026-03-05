import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { Crawler } from './crawler'
import type { CrawlOptions, LoginOptions } from './crawler'
import { AppDatabase } from './app-database'
import type { Pipeline, PipelineTask } from './pipeline/types'
import { PipelineExecutionEngine } from './pipeline/execution'
import type { CreateTaskDTO, TaskCategory } from './task/types'
import { appConfig } from './config'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

/**
 * 앱 전체의 DB 연결 — 유일한 소유자
 *
 * 이전 구조: historyDB(소유) + pipelineDB/pipelineManager/taskDB/taskManager(분산 변수)
 * 새 구조:   appDB 하나가 모든 서브모듈을 소유하고 관리
 */
const appDB = new AppDatabase()

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
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  setupIpcHandlers(mainWindow)
}

const setupIpcHandlers = (window: BrowserWindow) => {
  // ==================== 창 제어 ====================
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

  window.on('maximize', () => window.webContents.send('window:maximized-changed', true))
  window.on('unmaximize', () => window.webContents.send('window:maximized-changed', false))

  // ==================== 크롤링 ====================
  ipcMain.handle('crawler:start', async (_event, url: string, useSession: boolean = false, options?: unknown) => {
    try {
      const crawler = new Crawler(window)
      const result = await crawler.start(url, useSession, options as CrawlOptions)

      if (appDB.isOpen()) {
        appDB.saveHistory({
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

  ipcMain.handle('crawler:get-sessions', async () => {
    try {
      const crawler = new Crawler(window)
      return await crawler.getSavedSessions()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`세션 조회 실패: ${errorMessage}`)
    }
  })

  ipcMain.handle('crawler:delete-session', async (_event, hostname: string) => {
    try {
      const crawler = new Crawler(window)
      await crawler.deleteSession(hostname)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`세션 삭제 실패: ${errorMessage}`)
    }
  })

  // ==================== 저장소 관리 ====================

  /**
   * 저장 경로 선택 대화상자 (폴더 선택 UI → DB 초기화 → config 저장)
   */
  ipcMain.handle('storage:select-path', async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory', 'createDirectory'],
      title: '저장 데이터 경로 선택'
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = result.filePaths[0]
    appDB.open(selectedPath)           // 이미 같은 경로면 내부에서 스킵
    appConfig.set('storagePath', selectedPath) // config에도 반영
    return selectedPath
  })

  /**
   * 저장 경로 설정 (렌더러에서 이전에 저장된 경로로 호출)
   *
   * AppDatabase.open()이 내부에서 중복 호출을 방어하므로
   * 렌더러가 여러 번 호출해도 안전하다.
   */
  ipcMain.handle('storage:set-path', async (_event, storagePath: string) => {
    try {
      appDB.open(storagePath)           // 이미 같은 경로면 내부에서 스킵
      appConfig.set('storagePath', storagePath)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`저장 경로 설정 실패: ${errorMessage}`)
    }
  })

  ipcMain.handle('storage:get-saved-path', async () => {
    return appConfig.get('storagePath')
  })

  ipcMain.handle('storage:is-active', async () => {
    return appDB.isOpen()
  })

  // ==================== 히스토리 ====================
  ipcMain.handle('history:get-all', async () => appDB.getAllHistory())
  ipcMain.handle('history:get-recent', async (_event, limit: number = 10) => appDB.getRecentHistory(limit))
  ipcMain.handle('history:search', async (_event, url: string) => appDB.getHistoryByUrl(url))
  ipcMain.handle('history:delete', async (_event, id: number) => appDB.deleteHistory(id))
  ipcMain.handle('history:clear', async () => appDB.clearAllHistory())

  // ==================== Pipeline CRUD ====================
  ipcMain.handle('pipeline:create', async (_event, name: string, description?: string) => {
    if (!appDB.pipelineManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.pipelineManager.createPipeline(name, description)
  })

  ipcMain.handle('pipeline:save', async (_event, pipeline: unknown) => {
    if (!appDB.pipelineManager) throw new Error('저장소가 설정되지 않았습니다.')
    const p = pipeline as Pipeline
    return appDB.pipelineManager.savePipeline(p)
  })

  ipcMain.handle('pipeline:get', async (_event, id: string) => {
    if (!appDB.pipelineManager) return null
    return appDB.pipelineManager.getPipeline(id)
  })

  ipcMain.handle('pipeline:get-all', async () => {
    if (!appDB.pipelineManager) return []
    return appDB.pipelineManager.getAllPipelines()
  })

  ipcMain.handle('pipeline:search', async (_event, query: string) => {
    if (!appDB.pipelineManager) return []
    return appDB.pipelineManager.searchPipelines(query)
  })

  ipcMain.handle('pipeline:delete', async (_event, id: string) => {
    if (!appDB.pipelineManager) return false
    return appDB.pipelineManager.deletePipeline(id)
  })

  // ==================== Pipeline Task 관리 ====================
  ipcMain.handle('pipeline:add-task', async (_event, pipelineId: string, task: unknown) => {
    if (!appDB.pipelineManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.pipelineManager.addTask(pipelineId, task as PipelineTask)
  })

  ipcMain.handle('pipeline:remove-task', async (_event, pipelineId: string, taskName: string) => {
    if (!appDB.pipelineManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.pipelineManager.removeTask(pipelineId, taskName)
  })

  ipcMain.handle('pipeline:update-task', async (_event, pipelineId: string, taskName: string, updates: unknown) => {
    if (!appDB.pipelineManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.pipelineManager.updateTask(pipelineId, taskName, updates as Partial<PipelineTask>)
  })

  // ==================== Pipeline 검증/통계 ====================
  ipcMain.handle('pipeline:validate', async (_event, pipelineId: string) => {
    if (!appDB.pipelineManager) return { valid: false, errors: ['저장소가 설정되지 않았습니다.'], warnings: [] }
    return appDB.pipelineManager.validatePipeline(pipelineId)
  })

  ipcMain.handle('pipeline:get-stats', async (_event, pipelineId: string) => {
    if (!appDB.pipelineManager) return null
    return appDB.pipelineManager.getPipelineStats(pipelineId)
  })

  ipcMain.handle('pipeline:clone', async (_event, pipelineId: string, newName?: string) => {
    if (!appDB.pipelineManager) return null
    return appDB.pipelineManager.clonePipeline(pipelineId, newName)
  })

  // ==================== Task CRUD ====================
  ipcMain.handle('task:create', async (_event, dto: unknown) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.createTask(dto as CreateTaskDTO)
  })

  ipcMain.handle('task:update', async (_event, id: string, updates: unknown) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.updateTask(id, updates as Partial<CreateTaskDTO>)
  })

  ipcMain.handle('task:get', async (_event, id: string) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.getTask(id)
  })

  ipcMain.handle('task:get-all', async () => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.getAllTasks()
  })

  ipcMain.handle('task:get-by-category', async (_event, category: string) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.getTasksByCategory(category as TaskCategory)
  })

  ipcMain.handle('task:search', async (_event, query: string) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.searchTasks(query)
  })

  ipcMain.handle('task:delete', async (_event, id: string) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.deleteTask(id)
  })

  ipcMain.handle('task:delete-multiple', async (_event, ids: string[]) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.deleteTasks(ids)
  })

  ipcMain.handle('task:create-quick', async (_event, category: string) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.createQuickTask(category as TaskCategory)
  })

  ipcMain.handle('task:get-paginated', async (_event, category: string, page: number, pageSize: number) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.getTasksPaginated(category as TaskCategory, page, pageSize)
  })

  ipcMain.handle('task:validate', async (_event, task: unknown) => {
    if (!appDB.taskManager) throw new Error('저장소가 설정되지 않았습니다.')
    return appDB.taskManager.validateTask(task as any)
  })

  // ==================== Pipeline 실행 ====================
  ipcMain.handle('pipeline:execute', async (_event, pipelineId: string, initialUrl: string) => {
    if (!appDB.pipelineManager) throw new Error('저장소가 설정되지 않았습니다.')

    const pipeline = appDB.pipelineManager.getPipeline(pipelineId)
    if (!pipeline) throw new Error('파이프라인을 찾을 수 없습니다.')

    const executionId = randomUUID()
    const pdb = appDB.pipelineDB

    // 실행 기록 저장 (시작)
    if (pdb) {
      pdb.saveExecution({
        id: executionId, pipelineId, initialUrl,
        status: 'running', startedAt: Date.now()
      })
    }

    const engine = new PipelineExecutionEngine({
      onProgress: (event) => {
        window.webContents.send('pipeline:execution-progress', event)
      },
      saveStrings: (pid, eid, strings, dedup) => {
        pdb?.saveStrings(pid, eid, strings, dedup)
      },
      checkVisitedPage: (domain, p) => {
        return pdb?.checkVisitedPage(domain, p) ?? false
      },
      saveVisitedPage: (domain, p) => {
        pdb?.saveVisitedPage(domain, p)
      }
    })

    try {
      const result = await engine.execute(pipeline, initialUrl, executionId)

      if (pdb) {
        pdb.saveExecution({
          id: executionId, pipelineId, initialUrl,
          status: result.status, startedAt: result.startedAt,
          completedAt: result.completedAt, error: result.error
        })
      }

      window.webContents.send('pipeline:execution-complete', result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (pdb) {
        pdb.saveExecution({
          id: executionId, pipelineId, initialUrl,
          status: 'failed', startedAt: Date.now(),
          completedAt: Date.now(), error: errorMessage
        })
      }

      window.webContents.send('pipeline:execution-error', errorMessage)
      throw error
    }
  })
}

// ==================== 앱 생명주기 ====================

app.whenReady().then(() => {
  // config에 저장된 경로가 있으면 DB 열기
  const savedPath = appConfig.get('storagePath')
  if (savedPath) {
    appDB.open(savedPath)
  }

  createWindow()
})

app.on('window-all-closed', () => {
  appDB.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
