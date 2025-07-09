import { contextBridge, ipcRenderer } from 'electron'

// 렌더러 프로세스에서 사용할 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 예시: 메인 프로세스에 메시지 보내기
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
  
  // 예시: 메인 프로세스로부터 메시지 받기
  onMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('message-from-main', (event, message) => callback(message))
  },
  
  // 예시: 앱 정보 가져오기
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 예시: 파일 다이얼로그 열기
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog')
})

// TypeScript 타입 정의를 위한 전역 인터페이스
declare global {
  interface Window {
    electronAPI: {
      sendMessage: (message: string) => Promise<any>
      onMessage: (callback: (message: string) => void) => void
      getAppInfo: () => Promise<any>
      openFileDialog: () => Promise<any>
    }
  }
} 