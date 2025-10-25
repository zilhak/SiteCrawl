"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const crawler_1 = require("./crawler");
const isDev = !electron_1.app.isPackaged;
let mainWindow = null;
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    if (isDev) {
        // 개발 서버로부터 로딩
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        // 빌드된 정적 파일 로딩
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    // IPC 핸들러 등록
    setupIpcHandlers(mainWindow);
};
const setupIpcHandlers = (window) => {
    // 크롤링 시작
    electron_1.ipcMain.handle('crawler:start', async (_event, url, useSession = false, options) => {
        try {
            const crawler = new crawler_1.Crawler(window);
            const result = await crawler.start(url, useSession, options);
            window.webContents.send('crawler:complete', result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            window.webContents.send('crawler:error', errorMessage);
            throw error;
        }
    });
    // 자동 로그인
    electron_1.ipcMain.handle('crawler:login', async (_event, options) => {
        try {
            const crawler = new crawler_1.Crawler(window);
            await crawler.login(options);
            window.webContents.send('crawler:login-complete');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            window.webContents.send('crawler:error', errorMessage);
            throw error;
        }
    });
    // 수동 로그인
    electron_1.ipcMain.handle('crawler:manual-login', async (_event, url) => {
        try {
            const crawler = new crawler_1.Crawler(window);
            await crawler.manualLogin(url);
            window.webContents.send('crawler:login-complete');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            window.webContents.send('crawler:error', errorMessage);
            throw error;
        }
    });
    // 저장된 세션 목록 조회
    electron_1.ipcMain.handle('crawler:get-sessions', async () => {
        try {
            const crawler = new crawler_1.Crawler(window);
            return await crawler.getSavedSessions();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`세션 조회 실패: ${errorMessage}`);
        }
    });
    // 세션 삭제
    electron_1.ipcMain.handle('crawler:delete-session', async (_event, hostname) => {
        try {
            const crawler = new crawler_1.Crawler(window);
            await crawler.deleteSession(hostname);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`세션 삭제 실패: ${errorMessage}`);
        }
    });
};
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
