import { BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import { importGciIntoRaw } from './gcmemcard'
import { mergeUserSettings, readUserSettings, type MemcardUserSettings } from './userSettings'

export type MemcardFolderEvent = {
  rootDir: string
  eventKind: string
  filePath: string
}

const watchers = new Map<string, FSWatcher>()
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const DEBOUNCE_MS = 400

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function debouncedEmit(rootDir: string, payload: MemcardFolderEvent) {
  const key = rootDir
  const prev = debounceTimers.get(key)
  if (prev) clearTimeout(prev)
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key)
      broadcast('memcard:folder-changed', payload)
    }, DEBOUNCE_MS),
  )
}

export async function backupRawBeforeWrite(
  targetRawPath: string,
): Promise<{ skipped: true } | { ok: true; backupPath: string } | { ok: false; error: string }> {
  try {
    const stat = await fs.stat(targetRawPath).catch(() => null)
    if (!stat?.isFile()) {
      return { skipped: true }
    }
    const dir = path.dirname(targetRawPath)
    const ext = path.extname(targetRawPath) || '.raw'
    const base = path.basename(targetRawPath, ext)
    const backupsDir = path.join(dir, 'backups')
    await fs.mkdir(backupsDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupsDir, `${base}-${stamp}${ext}`)
    await fs.copyFile(targetRawPath, backupPath)
    return { ok: true, backupPath }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export function registerMemcardIpc() {
  ipcMain.handle('memcard:pickDirectory', async (event, defaultPath?: string | null) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: defaultPath || undefined,
    })
    if (canceled || !filePaths[0]) return null
    return filePaths[0]
  })

  ipcMain.handle('memcard:pickFile', async (event, filters?: { name: string; extensions: string[] }[]) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filters?.length ? filters : [{ name: 'Memory card', extensions: ['raw', 'gcp'] }],
    })
    if (canceled || !filePaths[0]) return null
    return filePaths[0]
  })

  ipcMain.handle('memcard:startWatch', async (_event, rootDir: string) => {
    if (!rootDir) return { ok: false as const, error: 'No path' }
    const existing = watchers.get(rootDir)
    if (existing) {
      await existing.close()
      watchers.delete(rootDir)
    }
    const w = chokidar.watch(rootDir, {
      ignoreInitial: true,
      ignored: (p) => path.basename(p).startsWith('.'),
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    })
    w.on('all', (eventKind, filePath) => {
      debouncedEmit(rootDir, { rootDir, eventKind, filePath })
    })
    watchers.set(rootDir, w)
    return { ok: true as const }
  })

  ipcMain.handle('memcard:stopWatch', async (_event, rootDir: string) => {
    const w = watchers.get(rootDir)
    if (w) {
      await w.close()
      watchers.delete(rootDir)
    }
    const t = debounceTimers.get(rootDir)
    if (t) clearTimeout(t)
    debounceTimers.delete(rootDir)
    return { ok: true as const }
  })

  ipcMain.handle('memcard:backupBeforeWrite', async (_event, targetRawPath: string) => {
    return backupRawBeforeWrite(targetRawPath)
  })

  ipcMain.handle('memcard:getUserSettings', async () => readUserSettings())

  ipcMain.handle('memcard:mergeUserSettings', async (_event, partial: Partial<MemcardUserSettings>) => {
    return mergeUserSettings(partial)
  })

  ipcMain.handle(
    'memcard:importGci',
    async (_event, args: { rawPath: string; gciPath: string }) => {
      const { rawPath, gciPath } = args
      if (!rawPath || !gciPath) {
        return { ok: false as const, error: 'Missing raw or GCI path' }
      }
      const backup = await backupRawBeforeWrite(rawPath)
      if ('ok' in backup && backup.ok === false) {
        return { ok: false as const, error: backup.error }
      }
      if ('skipped' in backup && backup.skipped) {
        return {
          ok: false as const,
          error: 'Target .raw does not exist; choose an existing memory card file first.',
        }
      }
      return importGciIntoRaw(rawPath, gciPath)
    },
  )
}
