import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

const FILE_NAME = 'memcard-user-settings.json'

export type MemcardUserSettings = {
  gciFolder: string | null
  rawPath: string | null
  lastGciPath: string | null
  folderWatchEnabled: boolean
  /** Where auto-built .raw files are written before SD copy. */
  stagingDir: string | null
  /** Debounce (ms) after last folder change before running a batch build. */
  gciBatchDebounceMs: number
  /** Relative to volume root, e.g. `nintendont/saves`. */
  nintendontSavesRelativePath: string
  /** Build new .raw from new GCIs when folder watch is active. */
  autoBuildRaw: boolean
  /** Copy pending staging .raw to SD when a suitable volume mounts. */
  autoCopyToSd: boolean
  /** If true, main process shows a confirm dialog before each SD copy. */
  confirmBeforeSdCopy: boolean
  /** Only treat volumes with this path as Wii SD targets (reduces false copies). */
  requireNintendontPath: boolean
  /** Normalize dentry filenames when importing GCIs onto a card. */
  gciFilenameSanitize: 'none' | 'ascii-title' | 'ascii-upper' | 'ascii-lower' | 'tmce-short'
}

const defaults: MemcardUserSettings = {
  gciFolder: null,
  rawPath: null,
  lastGciPath: null,
  folderWatchEnabled: false,
  stagingDir: null,
  gciBatchDebounceMs: 4000,
  nintendontSavesRelativePath: 'nintendont/saves',
  autoBuildRaw: true,
  autoCopyToSd: true,
  confirmBeforeSdCopy: false,
  requireNintendontPath: true,
  gciFilenameSanitize: 'none',
}

function filePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME)
}

function merge(a: MemcardUserSettings, partial: Partial<MemcardUserSettings>): MemcardUserSettings {
  return {
    gciFolder: partial.gciFolder !== undefined ? partial.gciFolder : a.gciFolder,
    rawPath: partial.rawPath !== undefined ? partial.rawPath : a.rawPath,
    lastGciPath: partial.lastGciPath !== undefined ? partial.lastGciPath : a.lastGciPath,
    folderWatchEnabled:
      partial.folderWatchEnabled !== undefined ? partial.folderWatchEnabled : a.folderWatchEnabled,
    stagingDir: partial.stagingDir !== undefined ? partial.stagingDir : a.stagingDir,
    gciBatchDebounceMs:
      partial.gciBatchDebounceMs !== undefined ? partial.gciBatchDebounceMs : a.gciBatchDebounceMs,
    nintendontSavesRelativePath:
      partial.nintendontSavesRelativePath !== undefined
        ? partial.nintendontSavesRelativePath
        : a.nintendontSavesRelativePath,
    autoBuildRaw: partial.autoBuildRaw !== undefined ? partial.autoBuildRaw : a.autoBuildRaw,
    autoCopyToSd: partial.autoCopyToSd !== undefined ? partial.autoCopyToSd : a.autoCopyToSd,
    confirmBeforeSdCopy:
      partial.confirmBeforeSdCopy !== undefined ? partial.confirmBeforeSdCopy : a.confirmBeforeSdCopy,
    requireNintendontPath:
      partial.requireNintendontPath !== undefined ? partial.requireNintendontPath : a.requireNintendontPath,
    gciFilenameSanitize:
      partial.gciFilenameSanitize !== undefined ? partial.gciFilenameSanitize : a.gciFilenameSanitize,
  }
}

export async function readUserSettings(): Promise<MemcardUserSettings> {
  try {
    const raw = await fs.readFile(filePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<MemcardUserSettings>
    return merge(defaults, {
      gciFolder: typeof parsed.gciFolder === 'string' ? parsed.gciFolder : null,
      rawPath: typeof parsed.rawPath === 'string' ? parsed.rawPath : null,
      lastGciPath: typeof parsed.lastGciPath === 'string' ? parsed.lastGciPath : null,
      folderWatchEnabled: typeof parsed.folderWatchEnabled === 'boolean' ? parsed.folderWatchEnabled : false,
      stagingDir: typeof parsed.stagingDir === 'string' ? parsed.stagingDir : null,
      gciBatchDebounceMs:
        typeof parsed.gciBatchDebounceMs === 'number' && parsed.gciBatchDebounceMs >= 500
          ? parsed.gciBatchDebounceMs
          : defaults.gciBatchDebounceMs,
      nintendontSavesRelativePath:
        typeof parsed.nintendontSavesRelativePath === 'string' && parsed.nintendontSavesRelativePath.length > 0
          ? parsed.nintendontSavesRelativePath
          : defaults.nintendontSavesRelativePath,
      autoBuildRaw: typeof parsed.autoBuildRaw === 'boolean' ? parsed.autoBuildRaw : defaults.autoBuildRaw,
      autoCopyToSd: typeof parsed.autoCopyToSd === 'boolean' ? parsed.autoCopyToSd : defaults.autoCopyToSd,
      confirmBeforeSdCopy:
        typeof parsed.confirmBeforeSdCopy === 'boolean' ? parsed.confirmBeforeSdCopy : defaults.confirmBeforeSdCopy,
      requireNintendontPath:
        typeof parsed.requireNintendontPath === 'boolean' ? parsed.requireNintendontPath : defaults.requireNintendontPath,
      gciFilenameSanitize:
        parsed.gciFilenameSanitize === 'ascii-title' ||
        parsed.gciFilenameSanitize === 'ascii-upper' ||
        parsed.gciFilenameSanitize === 'ascii-lower' ||
        parsed.gciFilenameSanitize === 'tmce-short' ||
        parsed.gciFilenameSanitize === 'none'
          ? parsed.gciFilenameSanitize
          : defaults.gciFilenameSanitize,
    })
  } catch {
    return { ...defaults }
  }
}

export async function mergeUserSettings(partial: Partial<MemcardUserSettings>): Promise<MemcardUserSettings> {
  const cur = await readUserSettings()
  const next = merge(cur, partial)
  await fs.mkdir(path.dirname(filePath()), { recursive: true })
  await fs.writeFile(filePath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}
