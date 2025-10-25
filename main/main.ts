import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { Crawler } from './crawler'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
  // 크롤링 시작
  ipcMain.handle('crawler:start', async (_event, url: string, useSession: boolean = false, options?: any) => {
    try {
      const crawler = new Crawler(window)
      const result = await crawler.start(url, useSession, options)
      window.webContents.send('crawler:complete', result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('crawler:error', errorMessage)
      throw error
    }
  })

  // 자동 로그인
  ipcMain.handle('crawler:login', async (_event, options: any) => {
    try {
      const crawler = new Crawler(window)
      await crawler.login(options)
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
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
