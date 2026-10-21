/// <reference types='vite/client' />

export type MemcardFolderEvent = {
  rootDir: string
  eventKind: string
  filePath: string
}

export type GciPathOverride = 'neutral' | 'exclude' | 'include'

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
  gciPathOverrides: Record<string, GciPathOverride>
  wiiSyncEnabled: boolean
  wiiSyncPort: number
  maxReplaysPerCard: number
  autoOrganizeGcis: boolean
  mainCharacter: number
  activePlaylist: string
  customPlaylists: CustomPlaylist[]
  includeArchive: boolean
  shuffleSeed: number
}

export type PlaylistOrder = 'newest' | 'shuffle'

export type CustomPlaylist = {
  id: string
  name: string
  /** Opponent character ids (Melee CKIND); empty = any matchup. */
  matchups: number[]
  order: PlaylistOrder
  count: number
}

export type PlaylistSummary = {
  id: string
  name: string
  group: 'recent' | 'matchup' | 'yours'
  description: string
  opponent?: number
  available: number
  shuffles: boolean
}

export type PlaylistView = {
  folder: string | null
  active: string
  activeName: string
  shuffles: boolean
  playlists: PlaylistSummary[]
  card: { path: string; name: string; opponent: number | null }[]
  gameSaves: number
  recordingCount: number
  archiveCount: number
  includeArchive: boolean
  cap: number
}

export type WiiSyncRequestLog = {
  at: number
  remoteAddress: string | undefined
  fileName: string
  status: number
}

export type WiiSyncStatus = {
  enabled: boolean
  running: boolean
  port: number | null
  discovery: boolean
  addresses: string[]
  error: string | null
  lastRequest: WiiSyncRequestLog | null
}

export type WiiSyncDelivery = {
  fileName: string
  localPath: string
  etag: string
  bytes: number
  remoteAddress: string | undefined
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
  getPlaylistView: () => Promise<PlaylistView>
  setActivePlaylist: (id: string) => Promise<void>
  savePlaylist: (
    p: Omit<CustomPlaylist, 'id'> & { id?: string },
  ) => Promise<{ ok: true; playlist: CustomPlaylist } | { ok: false; error: string }>
  deletePlaylist: (id: string) => Promise<void>
  onPlaylistsChanged: (callback: () => void) => () => void
  /** Saved .raw if it exists, else the auto-built staged GTME.raw. */
  resolveTargetCard: () => Promise<{ path: string; auto: boolean }>
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
    | { ok: true; entries: GciFolderEntry[]; cardStats: GciFolderScanCardStats | null; cardError?: string }
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
  getWiiSyncStatus: () => Promise<WiiSyncStatus>
  onWiiSyncStatus: (callback: (data: WiiSyncStatus) => void) => () => void
  onWiiSyncDelivered: (callback: (data: WiiSyncDelivery) => void) => () => void
}

declare global {
  interface Window {
    ipcRenderer: import('electron').IpcRenderer
    memcard: MemcardApi
  }
}
