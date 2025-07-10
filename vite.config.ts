import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import path from 'path'

export default defineConfig({
  root: 'renderer',
  base: './',
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    quasar({
      sassVariables: '@style/quasar-variables.scss'
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer'),
      '@style': path.resolve(__dirname, 'renderer/style'),
      '@interface': path.resolve(__dirname, 'types/interface'),
      '@component': path.resolve(__dirname, 'renderer/component')
    }
  }
})