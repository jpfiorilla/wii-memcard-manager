import fs from 'node:fs'
import { app, BrowserWindow, screen, shell, ipcMain, Tray, Menu } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import { registerMemcardIpc, resumeMemcardSession } from './memcard'
import { createAppWindowIcon, createTrayMenuBarImage } from './trayIcon'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

const publicDir = path.join(process.env.APP_ROOT, 'public')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? publicDir
  : fs.existsSync(path.join(publicDir, 'trayTemplate.png')) || fs.existsSync(path.join(publicDir, 'favicon.ico'))
    ? publicDir
    : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let tray: Tray | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow(startHidden = false) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    title: 'Wii Memcard Manager',
    width,
    height,
    show: false,
    icon: createAppWindowIcon(process.env.APP_ROOT, process.env.VITE_PUBLIC),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  win.once('ready-to-show', () => {
    win?.maximize()
    if (!startHidden) win?.show()
  })

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

registerMemcardIpc()

/**
 * Packaged macOS builds run as a background menu-bar app: registered as a login item the first
 * time they launch (toggle in the tray menu), and started without a window when macOS opens them
 * at login so the folder watch and Wii sync just run.
 */
const LOGIN_ITEM_MARKER = () => path.join(app.getPath('userData'), '.login-item-configured')

function ensureLoginItemOnFirstRun() {
  if (process.platform !== 'darwin' || !app.isPackaged) return
  if (fs.existsSync(LOGIN_ITEM_MARKER())) return
  app.setLoginItemSettings({ openAtLogin: true })
  try {
    fs.writeFileSync(LOGIN_ITEM_MARKER(), new Date().toISOString())
  } catch {
    /* ignore */
  }
}

function launchedAtLogin(): boolean {
  if (process.platform !== 'darwin' || !app.isPackaged) return false
  // wasOpenedAtLogin is unreliable on macOS 13+, so also treat "just booted" as a login launch.
  return Boolean(app.getLoginItemSettings().wasOpenedAtLogin) || os.uptime() < 300
}

app.whenReady().then(async () => {
  ensureLoginItemOnFirstRun()
  const startHidden = launchedAtLogin()
  if (startHidden) app.dock?.hide()
  createWindow(startHidden)
  await resumeMemcardSession()
  if (process.platform === 'darwin') {
    const img = createTrayMenuBarImage(process.env.APP_ROOT, process.env.VITE_PUBLIC)
    if (img.isEmpty()) {
      console.error('[tray] Icon image is empty; menu bar tray may not appear')
    }
    tray = new Tray(img)
    tray.setToolTip('Wii Memcard Manager — building and serving GTME.raw to the Wii')
    const showMainWindow = () => {
      app.dock?.show()
      if (win) {
        win.show()
        win.focus()
      } else {
        void createWindow()
      }
    }
    const buildTrayMenu = () =>
      Menu.buildFromTemplate([
        { label: 'Show', click: () => showMainWindow() },
        { type: 'separator' },
        {
          label: 'Open at Login',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          enabled: app.isPackaged,
          click: (item) => {
            app.setLoginItemSettings({ openAtLogin: item.checked })
            tray?.setContextMenu(buildTrayMenu())
          },
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ])
    tray.setContextMenu(buildTrayMenu())
  }
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') {
    app.quit()
  } else if (tray) {
    app.dock?.hide()
  }
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  if (process.platform === 'darwin') {
    app.dock?.show()
  }
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    void createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
