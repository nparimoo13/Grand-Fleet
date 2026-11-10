import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/** The dev server needs inline scripts (React refresh) and a websocket. Production keeps the strict CSP. */
const relaxedDevCsp: Plugin = {
  name: 'grandfleet-dev-csp',
  apply: 'serve',
  transformIndexHtml: {
    order: 'post',
    handler: (html) =>
      html.replace(
        /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?>/,
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: grandfleet:; font-src 'self' data:; connect-src 'self' grandfleet: ws://localhost:* http://localhost:*" />`
      )
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'electron/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'electron/preload/index.ts') } } }
  },
  renderer: {
    root: __dirname,
    build: { rollupOptions: { input: resolve(__dirname, 'index.html') } },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared')
      }
    },
    plugins: [react(), relaxedDevCsp]
  }
})
