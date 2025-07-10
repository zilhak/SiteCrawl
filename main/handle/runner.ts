import { ipcMain } from 'electron';


ipcMain.handle('run', async (event) => {
  return {
    success: true,
    message: 'Settings fetched successfully',
  }
})
