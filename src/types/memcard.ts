export type GciFolderEntry = {
  path: string
  fileName: string
  saveName: string
  alreadyOnCard: boolean
  parseError: string | null
  blockCount: number
  mtimeMs: number
}

export type CardScanStats = {
  directoryFileCount: number
  freeBlocks: number
}

export type PipelineSettingsState = {
  stagingDir: string | null
  gciBatchDebounceMs: number
  nintendontSavesRelativePath: string
  autoBuildRaw: boolean
  autoCopyToSd: boolean
  confirmBeforeSdCopy: boolean
}
