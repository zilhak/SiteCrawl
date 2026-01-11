import Store from 'electron-store'

interface AppConfig {
  storagePath: string
}

const appConfig = new Store<AppConfig>({
  defaults: {
    storagePath: ''
  }
})

export { appConfig }
