import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

const FILE_NAME = 'memcard-user-settings.json'

export type MemcardUserSettings = {
  gciFolder: string | null
  rawPath: string | null
  lastGciPath: string | null
  folderWatchEnabled: boolean
}

const defaults: MemcardUserSettings = {
  gciFolder: null,
  rawPath: null,
  lastGciPath: null,
  folderWatchEnabled: false,
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
