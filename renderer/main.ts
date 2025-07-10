import { createApp } from 'vue'
import App from './App.vue'
import { Quasar } from 'quasar'
import { Settings } from '@interface/settings'
import quasarIconSet from 'quasar/icon-set/material-icons'
import 'quasar/src/css/index.sass'

const app = createApp(App) 

app.use(Quasar, {
  plugins: {},
  iconSet: quasarIconSet,
})

app.mount('#app')
