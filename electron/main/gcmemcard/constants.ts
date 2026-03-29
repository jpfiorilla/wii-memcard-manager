/** GameCube memory card layout (Dolphin GCMemcard-compatible). */

export const MC_FST_BLOCKS = 5
export const MBIT_TO_BLOCKS = 0x10
export const DENTRY_STRLEN = 0x20
export const DENTRY_SIZE = 0x40
export const BLOCK_SIZE = 0x2000
export const BAT_SIZE = 0xffb
export const DIRLEN = 0x7f

export const MemCard59Mb = 0x04
export const MemCard123Mb = 0x08
export const MemCard251Mb = 0x10
export const Memcard507Mb = 0x20
export const MemCard1019Mb = 0x40
export const MemCard2043Mb = 0x80

export const VALID_SIZE_MB = new Set([
  MemCard59Mb,
  MemCard123Mb,
  MemCard251Mb,
  Memcard507Mb,
  MemCard1019Mb,
  MemCard2043Mb,
])

export type MemcardResultCode =
  | 'SUCCESS'
  | 'OPENFAIL'
  | 'OUTOFBLOCKS'
  | 'OUTOFDIRENTRIES'
  | 'LENGTHFAIL'
  | 'INVALIDFILESIZE'
  | 'TITLEPRESENT'
  | 'NOMEMCARD'
  | 'FAIL'
