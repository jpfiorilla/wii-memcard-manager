/// <reference types='vite/client' />

export type MemcardFolderEvent = {
  rootDir: string
  eventKind: string
  filePath: string
}

export type MemcardUserSettings = {
  gciFolder: string | null
  rawPath: string | null
  lastGciPath: string | null
  folderWatchEnabled: boolean
}

export type MemcardApi = {
  getUserSettings: () => Promise<MemcardUserSettings>
  mergeUserSettings: (partial: Partial<MemcardUserSettings>) => Promise<MemcardUserSettings>
  pickDirectory: (defaultPath?: string | null) => Promise<string | null>
  pickFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  startWatch: (dir: string) => Promise<{ ok: true } | { ok: false; error: string }>
  stopWatch: (dir: string) => Promise<{ ok: true }>
  backupBeforeWrite: (
    rawPath: string,
  ) => Promise<{ skipped: true } | { ok: true; backupPath: string } | { ok: false; error: string }>
  importGci: (rawPath: string, gciPath: string) => Promise<{ ok: true } | { ok: false; error: string }>
  onFolderChanged: (callback: (data: MemcardFolderEvent) => void) => () => void
}

declare global {
  interface Window {
    ipcRenderer: import('electron').IpcRenderer
    memcard: MemcardApi
  }
}
