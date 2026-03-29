import { describe, expect, it } from 'vitest'
import { BLOCK_SIZE, DENTRY_SIZE } from '../electron/main/gcmemcard/constants'
import { formatEmptyCard } from '../electron/main/gcmemcard/format'
import { MemcardImage } from '../electron/main/gcmemcard/memcardImage'
import { parseGciFile } from '../electron/main/gcmemcard/gci'

function buildMinimalGci(gamecode: string, filename: string, blockCount: number): Buffer {
  const dentry = Buffer.alloc(DENTRY_SIZE, 0xff)
  Buffer.from(gamecode.padEnd(4, '\0').slice(0, 4)).copy(dentry, 0)
  dentry.writeUInt16BE(0x3031, 4)
  Buffer.from(filename.padEnd(0x20, '\0').slice(0, 0x20), 'latin1').copy(dentry, 8)
  dentry.writeUInt32BE(0, 0x28)
  dentry.writeUInt32BE(0, 0x2c)
  dentry.writeUInt16BE(0, 0x30)
  dentry.writeUInt16BE(0, 0x32)
  dentry.writeUInt8(0x1c, 0x34)
  dentry.writeUInt8(0, 0x35)
  dentry.writeUInt16BE(0, 0x36)
  dentry.writeUInt16BE(blockCount, 0x38)
  dentry.writeUInt16BE(0xffff, 0x3a)
  dentry.writeUInt32BE(0xffffffff, 0x3c)

  const blocks: Buffer[] = []
  for (let i = 0; i < blockCount; i++) {
    const b = Buffer.alloc(BLOCK_SIZE, 0xff)
    b.writeUInt32BE(i, 0)
    blocks.push(b)
  }

  const payload = Buffer.concat(blocks)
  return Buffer.concat([dentry, payload])
}

describe('gcmemcard', () => {
  it('loads formatted empty card', () => {
    const raw = formatEmptyCard()
    const r = MemcardImage.load(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.card.maxBlock).toBe(0x80 * 0x10)
  })

  it('imports a single-block GCI and round-trips', () => {
    const raw = formatEmptyCard()
    const r = MemcardImage.load(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const card = r.card

    const gci = buildMinimalGci('GALE', 'TestSave', 1)
    const parsed = parseGciFile(gci)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const code = card.importSave(parsed.value.dentry, parsed.value.blocks)
    expect(code).toBe('SUCCESS')

    const out = card.toBuffer()
    const r2 = MemcardImage.load(out)
    expect(r2.ok).toBe(true)
    if (!r2.ok) return

    const dir = r2.card.getCurrentDirBuffer()
    expect(dir.readUInt32BE(0)).toBe(0x47414c45)
    expect(Buffer.from(dir.subarray(8, 8 + 8)).toString('latin1').replace(/\0/g, '')).toBe('TestSave')
  })

  it('rejects duplicate title', () => {
    const raw = formatEmptyCard()
    const r = MemcardImage.load(raw)
    if (!r.ok) return
    const card = r.card
    const gci = buildMinimalGci('GALE', 'Dup', 1)
    const parsed = parseGciFile(gci)
    if (!parsed.ok) return
    expect(card.importSave(parsed.value.dentry, parsed.value.blocks)).toBe('SUCCESS')
    expect(card.importSave(parsed.value.dentry, parsed.value.blocks)).toBe('TITLEPRESENT')
  })
})
