import { BLOCK_SIZE, DENTRY_SIZE } from './constants'

export type ParsedGci = {
  dentry: Buffer
  blocks: Buffer[]
}

/** Raw `.gci`: DENTRY (0x40) then `blockCount` × 0x2000 bytes. */
export function parseGciFile(data: Buffer): { ok: true; value: ParsedGci } | { ok: false; error: string } {
  if (data.length < DENTRY_SIZE + BLOCK_SIZE) {
    return { ok: false, error: 'GCI file too small' }
  }
  const dentry = Buffer.from(data.subarray(0, DENTRY_SIZE))
  const blockCount = dentry.readUInt16BE(0x38)
  if (blockCount === 0 || blockCount > 4091) {
    return { ok: false, error: 'Invalid block count in GCI' }
  }
  const expectedLen = DENTRY_SIZE + blockCount * BLOCK_SIZE
  if (data.length !== expectedLen) {
    return { ok: false, error: `GCI length mismatch: expected ${expectedLen}, got ${data.length}` }
  }
  const blocks: Buffer[] = []
  for (let i = 0; i < blockCount; i++) {
    const off = DENTRY_SIZE + i * BLOCK_SIZE
    blocks.push(Buffer.from(data.subarray(off, off + BLOCK_SIZE)))
  }
  return { ok: true, value: { dentry, blocks } }
}
