export interface Settings {
  type: 'scConfig',
  configPath: string | undefined,
  outputDir: string | undefined,

  protocol: string,
  domain: string,
  port: number,
  method: string,
  path: string[]
}

export const getDefaultSettings = (): Settings => ({
  type: 'scConfig',
  configPath: undefined,
  outputDir: undefined,

  protocol: 'http',
  domain: 'localhost',
  port: 80,
  method: 'GET',
  path: []
})