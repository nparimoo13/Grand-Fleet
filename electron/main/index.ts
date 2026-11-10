import { app, BrowserWindow, Menu, session, shell } from 'electron'
import { join } from 'node:path'
import { initAgents, shutdownAgents } from './agents/service'
import { registerAssetProtocol, registerAssetProtocolSchemes } from './asset-protocol'
import { closeDb } from './db'
import { registerIpc } from './ipc'
import { assetsRoot } from './paths'

// Tests and smoke runs point at a throwaway profile.
if (process.env.GRANDFLEET_USER_DATA) app.setPath('userData', process.env.GRANDFLEET_USER_DATA)

let mainWindow: BrowserWindow | null = null
const devUrl = process.env.ELECTRON_RENDERER_URL

function isAppUrl(url: string): boolean {
  return devUrl ? url.startsWith(devUrl) : url.startsWith('file://')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    title: 'Grand Fleet',
    // Brook, 8-bit (art-src/icon/app-icon.ts): the taskbar, Alt-Tab and window icon
    icon: join(assetsRoot(), 'icon', 'icon.png'),
    backgroundColor: '#2a1810',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // The renderer is a single local page: no popups, no navigation away.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault()
  })

  if (devUrl) void mainWindow.loadURL(devUrl)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

registerAssetProtocolSchemes()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(async () => {
    registerAssetProtocol()
    // Deny every permission request until a feature (e.g. voice) needs one.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    if (app.isPackaged) Menu.setApplicationMenu(null)
    await initAgents(() => mainWindow)
    registerIpc(() => mainWindow)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  // Kill every agent process (and their children) before the database closes and the app exits.
  let shuttingDown = false
  app.on('before-quit', (event) => {
    if (shuttingDown) return
    event.preventDefault()
    shuttingDown = true
    void shutdownAgents()
      .catch(() => undefined)
      .finally(() => {
        closeDb()
        app.quit()
      })
  })
}
