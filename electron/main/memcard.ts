import { BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import {
  describeGciDentry,
  importGciIntoRaw,
  importGcisIntoRaw,
  parseGciFile,
  scanGciFolderAgainstRaw,
  syncFolderSelectionToRaw,
} from './gcmemcard'
import { runGciBatchBuild } from './gciBatchPipeline'
import { mergeUserSettings, readUserSettings, type MemcardUserSettings } from './userSettings'
import { peekPendingSdAll, removePendingByLocalPath } from './pendingSdQueue'
import { showMemcardNotification } from './notifications'
import { copyLocalRawToSdSaves, isPathInsideRoot } from './sdTransfer'
import { startVolumeWatcherMacos, stopVolumeWatcher } from './volumeWatcher'

export type MemcardFolderEvent = {
  rootDir: string
  eventKind: string
  filePath: string
}

const watchers = new Map<string, FSWatcher>()
const folderUiTimers = new Map<string, ReturnType<typeof setTimeout>>()
const batchBuildTimers = new Map<string, ReturnType<typeof setTimeout>>()
const FOLDER_UI_DEBOUNCE_MS = 400

let batchBuildRunning = false
/** When a folder event fires while a batch is in progress, we coalesce into one rerun after it finishes. */
const pendingBatchRoots = new Set<string>()

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function debouncedEmitFolder(rootDir: string, payload: MemcardFolderEvent) {
  const prev = folderUiTimers.get(rootDir)
  if (prev) clearTimeout(prev)
  folderUiTimers.set(
    rootDir,
    setTimeout(() => {
      folderUiTimers.delete(rootDir)
      broadcast('memcard:folder-changed', payload)
    }, FOLDER_UI_DEBOUNCE_MS),
  )
}

function scheduleAutoBatch(rootDir: string) {
  void (async () => {
    const s = await readUserSettings()
    if (!s.autoBuildRaw || s.gciFolder !== rootDir) return
    const prev = batchBuildTimers.get(rootDir)
    if (prev) clearTimeout(prev)
    const ms = Math.max(500, s.gciBatchDebounceMs)
    batchBuildTimers.set(
      rootDir,
      setTimeout(() => {
        batchBuildTimers.delete(rootDir)
        void runBatchAndNotify(rootDir)
      }, ms),
    )
  })()
}

async function runBatchAndNotify(rootDir: string) {
  if (batchBuildRunning) {
    pendingBatchRoots.add(rootDir)
    return
  }
  const s = await readUserSettings()
  if (s.gciFolder !== rootDir || !s.autoBuildRaw) return

  batchBuildRunning = true
  try {
    const r = await runGciBatchBuild(s)
    if (!r.ok) {
      broadcast('memcard:batch-build-error', { error: r.error })
      return
    }
    broadcast('memcard:batch-built', { outputs: r.outputs, errors: r.errors })
    await processPendingSdOnAllVolumes({ notifyEachCopy: false })
    await notifyAfterBatchPipelineMacos(r.outputs, r.errors)
  } finally {
    batchBuildRunning = false
    const hadPending = pendingBatchRoots.size > 0
    pendingBatchRoots.clear()
    if (hadPending) {
      const latest = await readUserSettings()
      if (latest.gciFolder && latest.autoBuildRaw) {
        await runBatchAndNotify(latest.gciFolder)
      }
    }
  }
}

async function processSdTransfersForSavesDir(
  savesDir: string,
  s: MemcardUserSettings,
  opts?: { notifyEachCopy?: boolean },
) {
  if (!s.autoCopyToSd) return
  const notifyEachCopy = opts?.notifyEachCopy !== false

  const items = await peekPendingSdAll()
  if (items.length === 0) return

  for (const item of items) {
    try {
      await fs.access(item.localPath)
    } catch {
      await removePendingByLocalPath(item.localPath)
      broadcast('memcard:sd-transfer-error', {
        error: 'Staging file missing; removed from queue',
        localPath: item.localPath,
      })
      continue
    }

    if (s.confirmBeforeSdCopy) {
      const win = BrowserWindow.getFocusedWindow()
      const boxOpts = {
        type: 'question' as const,
        message: `Copy ${item.fileName} to the SD card?`,
        detail: `From:\n${item.localPath}\n\nTo:\n${path.join(savesDir, item.fileName)}`,
        buttons: ['Copy', 'Skip'],
        defaultId: 0,
        cancelId: 1,
      }
      const { response } = win ? await dialog.showMessageBox(win, boxOpts) : await dialog.showMessageBox(boxOpts)
      if (response === 1) continue
    }

    const r = await copyLocalRawToSdSaves({
      localPath: item.localPath,
      savesDir,
      destFileName: item.fileName,
      notify: notifyEachCopy && process.platform === 'darwin',
    })
    if (r.ok) {
      await removePendingByLocalPath(item.localPath)
      broadcast('memcard:sd-transfer-done', { destPath: r.destPath, localPath: item.localPath })
    } else {
      broadcast('memcard:sd-transfer-error', { error: r.error, localPath: item.localPath })
    }
  }
}

/** Copy pending staging .raw files to any mounted SD that exposes `nintendont/saves` (or configured path). */
async function processPendingSdOnAllVolumes(opts?: { notifyEachCopy?: boolean }) {
  if (process.platform !== 'darwin') return
  const s = await readUserSettings()
  if (!s.autoCopyToSd) return
  const names = await fs.readdir('/Volumes').catch(() => [])
  for (const name of names) {
    if (name.startsWith('.')) continue
    const mountPath = path.join('/Volumes', name)
    const savesDir = path.join(mountPath, s.nintendontSavesRelativePath)
    try {
      const st = await fs.stat(savesDir)
      if (!st.isDirectory()) continue
    } catch {
      continue
    }
    if (!isPathInsideRoot(mountPath, savesDir)) continue
    await processSdTransfersForSavesDir(savesDir, s, opts)
  }
}

async function notifySdVolumeMountedMacos(latest: MemcardUserSettings, volName: string) {
  if (process.platform !== 'darwin') return
  const savesRel = latest.nintendontSavesRelativePath
  if (!latest.autoCopyToSd) {
    await showMemcardNotification(
      'SD volume detected',
      `${volName} — ${savesRel} found. Auto-copy to SD is off (change in Settings to transfer).`,
    )
    return
  }
  const pending = await peekPendingSdAll()
  if (pending.length === 0) {
    await showMemcardNotification(
      'SD card synced',
      `${volName} — ${savesRel} found. No pending files; already up to date.`,
    )
    return
  }
  await showMemcardNotification(
    'SD volume ready',
    `${volName} — copying ${pending.length} pending file(s) to the card…`,
  )
}

async function notifyVolumeUnmountedMacos(mountPath: string) {
  if (process.platform !== 'darwin') return
  await showMemcardNotification('Volume ejected', `${path.basename(mountPath)} was unmounted.`)
}

async function notifyAfterBatchPipelineMacos(
  outputs: { path: string; gameCode: string }[],
  errors: string[],
) {
  if (process.platform !== 'darwin') return
  if (errors.length > 0) {
    const msg = errors.slice(0, 3).join(' · ')
    await showMemcardNotification('Batch build: issues', msg + (errors.length > 3 ? '…' : ''))
  }
  if (outputs.length === 0) return

  const s = await readUserSettings()
  const codes = outputs.map((o) => o.gameCode).join(', ')
  const pending = await peekPendingSdAll()

  if (!s.autoCopyToSd) {
    await showMemcardNotification(
      'Staging .raw built',
      `${codes} — saved to staging. Turn on auto-copy to SD in Settings to copy to the card.`,
    )
    return
  }
  if (pending.length === 0) {
    await showMemcardNotification(
      'Memory card ready',
      `${codes} — copied to SD (nintendont/saves).`,
    )
    return
  }
  await showMemcardNotification(
    'Staging .raw built',
    `${codes} — ${pending.length} file(s) still queued (insert SD or check ${s.nintendontSavesRelativePath}).`,
  )
}

function reconfigureVolumeWatcher() {
  stopVolumeWatcher()
  void (async () => {
    const s = await readUserSettings()
    startVolumeWatcherMacos({
      nintendontSavesRelativePath: s.nintendontSavesRelativePath,
      onMount: async (info) => {
        if (!isPathInsideRoot(info.mountPath, info.savesDir)) return
        broadcast('memcard:volume-mounted', {
          mountPath: info.mountPath,
          savesDir: info.savesDir,
        })
        const latest = await readUserSettings()
        const volName = path.basename(info.mountPath)
        await notifySdVolumeMountedMacos(latest, volName)
        await processSdTransfersForSavesDir(info.savesDir, latest)
      },
      onUnmount: (mountPath) => {
        broadcast('memcard:volume-unmounted', { mountPath })
        void notifyVolumeUnmountedMacos(mountPath)
      },
    })
  })()
}

export async function startFolderWatch(rootDir: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!rootDir) return { ok: false, error: 'No path' }
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
    debouncedEmitFolder(rootDir, { rootDir, eventKind, filePath })
    scheduleAutoBatch(rootDir)
  })
  watchers.set(rootDir, w)
  return { ok: true }
}

export async function resumeMemcardSession() {
  const s = await readUserSettings()
  if (s.gciFolder && s.folderWatchEnabled) {
    await startFolderWatch(s.gciFolder)
  }
  reconfigureVolumeWatcher()
  await processPendingSdOnAllVolumes()
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
    return startFolderWatch(rootDir)
  })

  ipcMain.handle('memcard:stopWatch', async (_event, rootDir: string) => {
    const w = watchers.get(rootDir)
    if (w) {
      await w.close()
      watchers.delete(rootDir)
    }
    const t = folderUiTimers.get(rootDir)
    if (t) clearTimeout(t)
    folderUiTimers.delete(rootDir)
    const bt = batchBuildTimers.get(rootDir)
    if (bt) clearTimeout(bt)
    batchBuildTimers.delete(rootDir)
    return { ok: true as const }
  })

  ipcMain.handle('memcard:backupBeforeWrite', async (_event, targetRawPath: string) => {
    return backupRawBeforeWrite(targetRawPath)
  })

  ipcMain.handle('memcard:getUserSettings', async () => readUserSettings())

  ipcMain.handle('memcard:mergeUserSettings', async (_event, partial: Partial<MemcardUserSettings>) => {
    const next = await mergeUserSettings(partial)
    reconfigureVolumeWatcher()
    await processPendingSdOnAllVolumes()
    return next
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
      const s = await readUserSettings()
      return importGciIntoRaw(rawPath, gciPath, { gciFilenameSanitize: s.gciFilenameSanitize })
    },
  )

  ipcMain.handle(
    'memcard:scanGciFolder',
    async (_event, args: { rawPath: string; gciFolder: string }) => {
      const { rawPath, gciFolder } = args
      if (!rawPath || !gciFolder) {
        return { ok: false as const, error: 'Missing .raw path or GCI folder' }
      }
      return scanGciFolderAgainstRaw(rawPath, gciFolder)
    },
  )

  ipcMain.handle(
    'memcard:importGcis',
    async (_event, args: { rawPath: string; gciPaths: string[] }) => {
      const { rawPath, gciPaths } = args
      if (!rawPath || !gciPaths?.length) {
        return { ok: false as const, error: 'Missing target .raw or GCI list' }
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
      const s = await readUserSettings()
      return importGcisIntoRaw(rawPath, gciPaths, { gciFilenameSanitize: s.gciFilenameSanitize })
    },
  )

  ipcMain.handle('memcard:describeGci', async (_event, gciPath: string) => {
    if (!gciPath) {
      return { ok: false as const, error: 'Missing GCI path' }
    }
    let buf: Buffer
    try {
      buf = await fs.readFile(gciPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false as const, error: msg }
    }
    const gci = parseGciFile(buf)
    if (!gci.ok) {
      return { ok: false as const, error: gci.error }
    }
    return { ok: true as const, description: describeGciDentry(gci.value.dentry) }
  })

  ipcMain.handle(
    'memcard:syncFolderSelection',
    async (
      _event,
      args: { rawPath: string; gciPathsToAdd: string[]; gciPathsToRemove: string[] },
    ) => {
      const { rawPath, gciPathsToAdd, gciPathsToRemove } = args
      if (!rawPath) {
        return { ok: false as const, error: 'Missing target .raw' }
      }
      if (
        (!gciPathsToAdd || gciPathsToAdd.length === 0) &&
        (!gciPathsToRemove || gciPathsToRemove.length === 0)
      ) {
        return { ok: false as const, error: 'Nothing to apply' }
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
      return syncFolderSelectionToRaw(rawPath, {
        gciPathsToAdd: gciPathsToAdd ?? [],
        gciPathsToRemove: gciPathsToRemove ?? [],
      })
    },
  )
}
