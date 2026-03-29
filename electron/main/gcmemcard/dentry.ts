import { DENTRY_SIZE } from './constants'

export function readDEntry(buf: Buffer, offset: number): Buffer {
  return buf.subarray(offset, offset + DENTRY_SIZE)
}

export function dentryGamecodeU32(d: Buffer): number {
  return d.readUInt32BE(0)
}

/** Four-character game code from dentry (Nintendont-style .raw basename, e.g. GTME). */
export function dentryGameCodeString(d: Buffer): string {
  const b = d.subarray(0, 4)
  let s = ''
  for (let i = 0; i < 4; i++) {
    const c = b[i]
    if (c === undefined || c === 0) break
    s += String.fromCharCode(c)
  }
  return s || 'UNK'
}

export function isDentryEmpty(d: Buffer): boolean {
  return dentryGamecodeU32(d) === 0xffffffff
}

export function readDEntryBlockCount(d: Buffer): number {
  return d.readUInt16BE(0x38)
}

export function readDEntryFirstBlock(d: Buffer): number {
  return d.readUInt16BE(0x36)
}

export function filenameString(d: Buffer): string {
  const end = d.indexOf(0, 8)
  const len = end === -1 ? 0x20 : Math.min(end - 8, 0x20)
  return d.toString('latin1', 8, 8 + len)
}
