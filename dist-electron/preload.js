"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('crawler', {
    startCrawl: (url) => electron_1.ipcRenderer.invoke('crawler:start', url),
    onProgress: (callback) => {
        electron_1.ipcRenderer.on('crawler:progress', (_event, data) => callback(data));
    },
    onComplete: (callback) => {
        electron_1.ipcRenderer.on('crawler:complete', (_event, data) => callback(data));
    },
    onError: (callback) => {
        electron_1.ipcRenderer.on('crawler:error', (_event, error) => callback(error));
    }
});
