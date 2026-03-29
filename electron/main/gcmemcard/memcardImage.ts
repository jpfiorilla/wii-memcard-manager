import {
  BLOCK_SIZE,
  DENTRY_SIZE,
  DENTRY_STRLEN,
  DIRLEN,
  MC_FST_BLOCKS,
  MBIT_TO_BLOCKS,
  VALID_SIZE_MB,
  type MemcardResultCode,
} from './constants'
import {
  setDirectoryChecksum,
  setBatChecksum,
  verifyHeaderChecksum,
  verifyDirectoryChecksum,
  verifyBatChecksum,
} from './checksum'
import { getNextBlockFromBat, nextFreeBlock } from './bat'
import { dentryGamecodeU32, filenameString } from './dentry'
import { gcTimestampSecondsFromUnixMs } from './gcTime'
import { fzeroMakeSaveGameValid, psoMakeSaveGameValid } from './specialSaves'

function titlePresent(dirBlock: Buffer, gamecode: Buffer, filename32: Buffer): number {
  for (let i = 0; i < DIRLEN; i++) {
    const off = i * DENTRY_SIZE
    const d = dirBlock.subarray(off, off + DENTRY_SIZE)
    if (
      dentryGamecodeU32(d) === gamecode.readUInt32BE(0) &&
      d.subarray(8, 8 + DENTRY_STRLEN).equals(filename32.subarray(0, DENTRY_STRLEN))
    ) {
      return i
    }
  }
  return DIRLEN
}

function getNumFiles(dirBlock: Buffer): number {
  let j = 0
  for (let i = 0; i < DIRLEN; i++) {
    const off = i * DENTRY_SIZE
    if (dirBlock.readUInt32BE(off) !== 0xffffffff) j++
  }
  return j
}

export type LoadRawResult =
  | { ok: true; card: MemcardImage }
  | { ok: false; error: string }

export class MemcardImage {
  hdr: Buffer
  dirA: Buffer
  dirB: Buffer
  batA: Buffer
  batB: Buffer
  dataBlocks: Buffer[]
  maxBlock: number
  sizeMb: number
  currentDirIdx: 0 | 1
  currentBatIdx: 0 | 1

  private constructor(
    hdr: Buffer,
    dirA: Buffer,
    dirB: Buffer,
    batA: Buffer,
    batB: Buffer,
    dataBlocks: Buffer[],
    maxBlock: number,
    sizeMb: number,
    currentDirIdx: 0 | 1,
    currentBatIdx: 0 | 1,
  ) {
    this.hdr = hdr
    this.dirA = dirA
    this.dirB = dirB
    this.batA = batA
    this.batB = batB
    this.dataBlocks = dataBlocks
    this.maxBlock = maxBlock
    this.sizeMb = sizeMb
    this.currentDirIdx = currentDirIdx
    this.currentBatIdx = currentBatIdx
  }

  static load(raw: Buffer): LoadRawResult {
    if (raw.length < MC_FST_BLOCKS * BLOCK_SIZE) {
      return { ok: false, error: 'File too small to be a memory card' }
    }
    if (raw.length % BLOCK_SIZE !== 0) {
      return { ok: false, error: 'Memory card size is not a multiple of block size' }
    }
    const blocks = raw.length / BLOCK_SIZE
    const sizeMb = blocks / MBIT_TO_BLOCKS
    if (!VALID_SIZE_MB.has(sizeMb)) {
      return { ok: false, error: `Unsupported card size (header Mbit 0x${sizeMb.toString(16)})` }
    }

    const hdr = Buffer.from(raw.subarray(0, BLOCK_SIZE))
    const dirA = Buffer.from(raw.subarray(BLOCK_SIZE, BLOCK_SIZE * 2))
    const dirB = Buffer.from(raw.subarray(BLOCK_SIZE * 2, BLOCK_SIZE * 3))
    const batA = Buffer.from(raw.subarray(BLOCK_SIZE * 3, BLOCK_SIZE * 4))
    const batB = Buffer.from(raw.subarray(BLOCK_SIZE * 4, BLOCK_SIZE * 5))

    if (!verifyHeaderChecksum(hdr)) {
      return { ok: false, error: 'Header checksum failed' }
    }

    const hdrSizeMb = hdr.readUInt16BE(0x22)
    if (hdrSizeMb !== sizeMb) {
      return { ok: false, error: 'Memory card file size does not match the header size' }
    }

    let d0 = dirA
    let d1 = dirB
    let b0 = batA
    let b1 = batB

    const dirOk0 = verifyDirectoryChecksum(d0)
    const dirOk1 = verifyDirectoryChecksum(d1)
    if (!dirOk0 && !dirOk1) {
      return { ok: false, error: 'Directory checksum and directory backup checksum failed' }
    }
    const batOk0 = verifyBatChecksum(b0)
    const batOk1 = verifyBatChecksum(b1)
    if (!batOk0 && !batOk1) {
      return { ok: false, error: 'Block Allocation Table checksum failed' }
    }

    if ((!dirOk0 && dirOk1) || (!batOk0 && batOk1)) {
      d0 = Buffer.from(d1)
      b0 = Buffer.from(b1)
    }

    const ucD0 = d0.readUInt16BE(0x1ffa)
    const ucD1 = d1.readUInt16BE(0x1ffa)
    const currentDirIdx: 0 | 1 = ucD0 > ucD1 ? 0 : 1

    const ucB0 = b0.readUInt16BE(0x04)
    const ucB1 = b1.readUInt16BE(0x04)
    const currentBatIdx: 0 | 1 = ucB0 > ucB1 ? 0 : 1

    const maxBlock = sizeMb * MBIT_TO_BLOCKS
    const dataBlockCount = maxBlock - MC_FST_BLOCKS
    const expectedLen = MC_FST_BLOCKS * BLOCK_SIZE + dataBlockCount * BLOCK_SIZE
    if (raw.length < expectedLen) {
      return { ok: false, error: 'Memory card file is truncated' }
    }

    const dataBlocks: Buffer[] = []
    for (let i = 0; i < dataBlockCount; i++) {
      const off = MC_FST_BLOCKS * BLOCK_SIZE + i * BLOCK_SIZE
      dataBlocks.push(Buffer.from(raw.subarray(off, off + BLOCK_SIZE)))
    }

    return {
      ok: true,
      card: new MemcardImage(hdr, d0, d1, b0, b1, dataBlocks, maxBlock, sizeMb, currentDirIdx, currentBatIdx),
    }
  }

  getCurrentDirBuffer(): Buffer {
    return this.currentDirIdx === 0 ? this.dirA : this.dirB
  }

  getPreviousDirBuffer(): Buffer {
    return this.currentDirIdx === 0 ? this.dirB : this.dirA
  }

  getCurrentBatBuffer(): Buffer {
    return this.currentBatIdx === 0 ? this.batA : this.batB
  }

  getPreviousBatBuffer(): Buffer {
    return this.currentBatIdx === 0 ? this.batB : this.batA
  }

  toBuffer(): Buffer {
    const parts: Buffer[] = [this.hdr, this.dirA, this.dirB, this.batA, this.batB, ...this.dataBlocks]
    return Buffer.concat(parts)
  }

  /** True if this save identity (game code + 32-char filename) already exists on the current directory. */
  isTitlePresent(dentry: Buffer): boolean {
    const gamecode = dentry.subarray(0, 4)
    const fn = dentry.subarray(8, 8 + DENTRY_STRLEN)
    return titlePresent(this.getCurrentDirBuffer(), gamecode, fn) !== DIRLEN
  }

  getDirectoryEntryCount(): number {
    return getNumFiles(this.getCurrentDirBuffer())
  }

  getFreeBlockCount(): number {
    return this.getCurrentBatBuffer().readUInt16BE(0x06)
  }

  importSave(
    dentry: Buffer,
    saveBlocks: Buffer[],
    opts?: { mTimeGcSeconds?: number },
  ): MemcardResultCode {
    if (getNumFiles(this.getCurrentDirBuffer()) >= DIRLEN) {
      return 'OUTOFDIRENTRIES'
    }

    const needBlocks = dentry.readUInt16BE(0x38)
    const curBat = this.getCurrentBatBuffer()
    if (curBat.readUInt16BE(0x06) < needBlocks) {
      return 'OUTOFBLOCKS'
    }

    const gamecode = dentry.subarray(0, 4)
    const fn = dentry.subarray(8, 8 + DENTRY_STRLEN)
    if (titlePresent(this.getCurrentDirBuffer(), gamecode, fn) !== DIRLEN) {
      return 'TITLEPRESENT'
    }

    const lastAlloc = curBat.readUInt16BE(0x08)
    const startScan = Math.max(lastAlloc, MC_FST_BLOCKS)
    const firstBlock = nextFreeBlock(curBat, this.maxBlock, startScan)
    if (firstBlock === 0xffff) {
      return 'OUTOFBLOCKS'
    }

    const updatedDir = Buffer.from(this.getCurrentDirBuffer())
    let placed = false
    for (let i = 0; i < DIRLEN; i++) {
      const off = i * DENTRY_SIZE
      if (updatedDir.readUInt32BE(off) === 0xffffffff) {
        dentry.copy(updatedDir, off, 0, DENTRY_SIZE)
        updatedDir.writeUInt16BE(firstBlock, off + 0x36)
        updatedDir.writeUInt8((dentry.readUInt8(0x35) + 1) & 0xff, off + 0x35)
        if (updatedDir.readUInt32BE(off + 0x28) === 0) {
          const sec =
            opts?.mTimeGcSeconds !== undefined
              ? opts.mTimeGcSeconds >>> 0
              : gcTimestampSecondsFromUnixMs(Date.now())
          updatedDir.writeUInt32BE(sec, off + 0x28)
        }
        placed = true
        break
      }
    }
    if (!placed) {
      return 'OUTOFDIRENTRIES'
    }

    const uc = (updatedDir.readUInt16BE(0x1ffa) + 1) & 0xffff
    updatedDir.writeUInt16BE(uc, 0x1ffa)
    setDirectoryChecksum(updatedDir)

    const prevDirIdx = (1 - this.currentDirIdx) as 0 | 1
    if (prevDirIdx === 0) this.dirA = updatedDir
    else this.dirB = updatedDir
    this.currentDirIdx = prevDirIdx

    const fnStr = filenameString(dentry)
    const blocksCopy = saveBlocks.map((b) => Buffer.from(b))
    fzeroMakeSaveGameValid(this.hdr, fnStr, blocksCopy)
    psoMakeSaveGameValid(this.hdr, fnStr, blocksCopy)

    const updatedBat = Buffer.from(this.getCurrentBatBuffer())
    const fileBlocks = needBlocks
    let block = firstBlock

    for (let i = 0; i < fileBlocks; i++) {
      const dataIdx = block - MC_FST_BLOCKS
      if (dataIdx < 0 || dataIdx >= this.dataBlocks.length) return 'FAIL'
      this.dataBlocks[dataIdx] = blocksCopy[i]!

      const nextBlock =
        i === fileBlocks - 1 ? 0xffff : nextFreeBlock(updatedBat, this.maxBlock, block + 1)
      if (i < fileBlocks - 1 && nextBlock === 0xffff) return 'OUTOFBLOCKS'

      updatedBat.writeUInt16BE(nextBlock & 0xffff, 0x0a + (block - MC_FST_BLOCKS) * 2)
      updatedBat.writeUInt16BE(block & 0xffff, 0x08)
      block = nextBlock
    }

    const free = updatedBat.readUInt16BE(0x06)
    updatedBat.writeUInt16BE((free - fileBlocks) & 0xffff, 0x06)
    updatedBat.writeUInt16BE((updatedBat.readUInt16BE(0x04) + 1) & 0xffff, 0x04)
    setBatChecksum(updatedBat)

    const prevBatIdx = (1 - this.currentBatIdx) as 0 | 1
    if (prevBatIdx === 0) this.batA = updatedBat
    else this.batB = updatedBat
    this.currentBatIdx = prevBatIdx

    return 'SUCCESS'
  }

  /**
   * Remove a save that matches `dentry` identity (game code + 32-byte filename) on the active directory.
   * Frees BAT chain and clears the directory slot (Dolphin-compatible).
   */
  removeSaveByIdentity(dentry: Buffer): MemcardResultCode {
    const gamecode = dentry.subarray(0, 4)
    const fn = dentry.subarray(8, 8 + DENTRY_STRLEN)
    const idx = titlePresent(this.getCurrentDirBuffer(), gamecode, fn)
    if (idx === DIRLEN) {
      return 'NOTFOUND'
    }

    const off = idx * DENTRY_SIZE
    const curDir = this.getCurrentDirBuffer()
    const firstBlock = curDir.readUInt16BE(off + 0x36)
    const blockCount = curDir.readUInt16BE(off + 0x38)

    if (blockCount === 0 || firstBlock === 0xffff || firstBlock < MC_FST_BLOCKS) {
      return 'FAIL'
    }

    const updatedBat = Buffer.from(this.getCurrentBatBuffer())
    let block = firstBlock
    for (let i = 0; i < blockCount; i++) {
      if (block === 0xffff || block < MC_FST_BLOCKS || block >= this.maxBlock) {
        return 'FAIL'
      }
      const next = getNextBlockFromBat(updatedBat, block)
      updatedBat.writeUInt16BE(0, 0x0a + (block - MC_FST_BLOCKS) * 2)
      const dataIdx = block - MC_FST_BLOCKS
      if (dataIdx >= 0 && dataIdx < this.dataBlocks.length) {
        this.dataBlocks[dataIdx] = Buffer.alloc(BLOCK_SIZE, 0xff)
      }
      block = next
    }
    if (block !== 0xffff) {
      return 'FAIL'
    }

    const free = updatedBat.readUInt16BE(0x06)
    updatedBat.writeUInt16BE((free + blockCount) & 0xffff, 0x06)
    updatedBat.writeUInt16BE((updatedBat.readUInt16BE(0x04) + 1) & 0xffff, 0x04)
    setBatChecksum(updatedBat)

    const prevBatIdx = (1 - this.currentBatIdx) as 0 | 1
    if (prevBatIdx === 0) this.batA = updatedBat
    else this.batB = updatedBat
    this.currentBatIdx = prevBatIdx

    const updatedDir = Buffer.from(this.getCurrentDirBuffer())
    updatedDir.fill(0xff, off, off + DENTRY_SIZE)
    const uc = (updatedDir.readUInt16BE(0x1ffa) + 1) & 0xffff
    updatedDir.writeUInt16BE(uc, 0x1ffa)
    setDirectoryChecksum(updatedDir)

    const prevDirIdx = (1 - this.currentDirIdx) as 0 | 1
    if (prevDirIdx === 0) this.dirA = updatedDir
    else this.dirB = updatedDir
    this.currentDirIdx = prevDirIdx

    return 'SUCCESS'
  }
}
