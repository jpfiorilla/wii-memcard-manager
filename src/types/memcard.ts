/** Per-file override for automatic importable selection. */
export type GciPathOverride = "neutral" | "exclude" | "include";

export type GciFolderEntry = {
  path: string
  fileName: string
  saveName: string
  alreadyOnCard: boolean
  parseError: string | null
  blockCount: number
  mtimeMs: number
  /** TM:CE recording metadata (characters as Melee CKIND ids), when decodable. */
  tmce?: { hmn: number; hmnCostume: number; cpu: number; cpuCostume: number; name: string } | null
}

export type CardScanStats = {
  directoryFileCount: number
  freeBlocks: number
}

export type GciFilenameSanitizeStyle =
  | 'none'
  | 'ascii-title'
  | 'ascii-upper'
  | 'ascii-lower'
  | 'tmce-short'

export type PipelineSettingsState = {
  stagingDir: string | null
  gciBatchDebounceMs: number
  nintendontSavesRelativePath: string
  autoBuildRaw: boolean
  autoCopyToSd: boolean
  confirmBeforeSdCopy: boolean
  gciFilenameSanitize: GciFilenameSanitizeStyle
  /** OS + in-app alerts from background pipeline (batch, SD, volumes). */
  notificationsEnabled: boolean
  /** Serve staged .raw files to the Wii TM Sync app over Wi-Fi. */
  wiiSyncEnabled: boolean
  wiiSyncPort: number
  maxReplaysPerCard: number
  autoOrganizeGcis: boolean
  mainCharacter: number
}
