import { ipcMain } from 'electron';
import { getDefaultSettings, Settings } from '../../types/interface/settings';
import fs from 'fs';
import path from 'path';

const configFileName = 'sc.config.json';
const configPathsList = [
  './' + configFileName,
  '~/' + configFileName,
]

const findConfigPath = (): string | undefined => {
  for (const path of configPathsList) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  
  return undefined;
}

const getSettings = (): Settings => {
  const configPath = findConfigPath();
  if (configPath) {
    const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return settings;
  }
  
  return getDefaultSettings();
}

let settings = getSettings();

const fixConfigPath = (configPath: string | undefined) => {
  if (!configPath)
    return configPath;

  if (fs.existsSync(configPath)) {
    if (fs.statSync(configPath).isDirectory()) {
      configPath = path.join(configPath, configFileName);
      if (!fs.existsSync(configPath)) {
        return configPath;
      }    
    }
    
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (data.type === 'scConfig')
      return configPath;
    
    return undefined;
  }
  
  return configPath;
}

ipcMain.handle('get-settings', async (event) : Promise<Settings> => {
  return settings;
})

ipcMain.handle('set-settings', async (event, setting: Settings) => {
  settings = setting;

  const fixedConfigPath = fixConfigPath(setting.configPath);
  if (!fixedConfigPath)
    return;
  
  setting.configPath = fixedConfigPath;
  fs.writeFileSync(fixedConfigPath, JSON.stringify(setting, null, 2));
})