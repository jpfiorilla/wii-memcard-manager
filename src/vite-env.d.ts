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
  stagingDir: string | null
  gciBatchDebounceMs: number
  nintendontSavesRelativePath: string
  autoBuildRaw: boolean
  autoCopyToSd: boolean
  confirmBeforeSdCopy: boolean
  requireNintendontPath: boolean
  gciFilenameSanitize: 'none' | 'ascii-title' | 'ascii-upper' | 'ascii-lower' | 'tmce-short'
  notificationsEnabled: boolean
}

export type GciDentryDescription = {
  gameCode: string
  companyCode: string
  filenameInDentry: string
  note: string
  /** Melee roster ID when inferred from GTME `slug-...` dentry filename. */
  meleeCharacterFromFilename?: number
}

export type GciFolderScanCardStats = {
  directoryFileCount: number
  freeBlocks: number
}

export type GciFolderEntry = {
  path: string
  fileName: string
  saveName: string
  alreadyOnCard: boolean
  parseError: string | null
  blockCount: number
  mtimeMs: number
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
  scanGciFolder: (args: {
    rawPath: string
    gciFolder: string
  }) => Promise<
    | { ok: true; entries: GciFolderEntry[]; cardStats: GciFolderScanCardStats }
    | { ok: false; error: string }
  >
  importGcis: (rawPath: string, gciPaths: string[]) => Promise<{ ok: true } | { ok: false; error: string }>
  syncFolderSelection: (
    rawPath: string,
    args: { gciPathsToAdd: string[]; gciPathsToRemove: string[] },
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  describeGci: (
    gciPath: string,
  ) => Promise<{ ok: true; description: GciDentryDescription } | { ok: false; error: string }>
  onFolderChanged: (callback: (data: MemcardFolderEvent) => void) => () => void
  onBatchBuilt: (
    callback: (data: { outputs: { path: string; gameCode: string }[]; errors: string[] }) => void,
  ) => () => void
  onBatchBuildError: (callback: (data: { error: string }) => void) => () => void
  onVolumeMounted: (callback: (data: { mountPath: string; savesDir: string }) => void) => () => void
  onVolumeUnmounted: (callback: (data: { mountPath: string }) => void) => () => void
  onSdTransferDone: (callback: (data: { destPath: string; localPath: string }) => void) => () => void
  onSdTransferError: (callback: (data: { error: string; localPath: string }) => void) => () => void
}

declare global {
  interface Window {
    ipcRenderer: import('electron').IpcRenderer
    memcard: MemcardApi
  }
}
