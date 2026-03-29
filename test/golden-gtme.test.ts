import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BLOCK_SIZE, DENTRY_SIZE, DIRLEN, MBIT_TO_BLOCKS } from '../electron/main/gcmemcard/constants'
import { MemcardImage } from '../electron/main/gcmemcard/memcardImage'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Real Wii / Nintendont TM:CE card — do not modify; see test/fixtures/golden/README.md */
export const GOLDEN_GTME_PATH = join(__dirname, 'fixtures', 'golden', 'GTME.raw')

/** SHA-256 of the exact bytes on disk — bump only when intentionally replacing the golden file */
const GOLDEN_GTME_SHA256 =
  'd8c5f81124fa262b0c026cc6eef9c1aa38336b5a3a823a6a0ee83d88cae651fa'

function readGoldenGtme(): Buffer {
  return readFileSync(GOLDEN_GTME_PATH)
}

function countDirFiles(dirBlock: Buffer): number {
  let n = 0
  for (let i = 0; i < DIRLEN; i++) {
    const off = i * DENTRY_SIZE
    if (dirBlock.readUInt32BE(off) !== 0xffffffff) n++
  }
  return n
}

describe('golden GTME.raw (Wii TM:CE default save)', () => {
  it('fixture exists and matches recorded SHA-256 (detect accidental edits)', () => {
    const buf = readGoldenGtme()
    const hash = createHash('sha256').update(buf).digest('hex')
    expect(hash).toBe(GOLDEN_GTME_SHA256)
  })

  it('has expected Nintendont / Dolphin card size (2 MiB, 251-Mbit class layout)', () => {
    const buf = readGoldenGtme()
    expect(buf.length).toBe(2097152)
    expect(buf.length % BLOCK_SIZE).toBe(0)
    const blocks = buf.length / BLOCK_SIZE
    const sizeMb = blocks / MBIT_TO_BLOCKS
    expect(sizeMb).toBe(0x10)
  })

  it('MemcardImage.load succeeds and round-trips bytes without mutation', () => {
    const original = readGoldenGtme()
    const loaded = MemcardImage.load(original)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const { card } = loaded
    expect(card.maxBlock).toBe(256)
    expect(card.sizeMb).toBe(0x10)

    const roundTrip = card.toBuffer()
    expect(roundTrip.equals(original)).toBe(true)
  })

  it('reports a sane directory and BAT (fresh default save card)', () => {
    const loaded = MemcardImage.load(readGoldenGtme())
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const dir = loaded.card.getCurrentDirBuffer()
    const files = countDirFiles(dir)
    expect(files).toBeGreaterThanOrEqual(1)
    expect(files).toBeLessThan(DIRLEN)

    const bat = loaded.card.getCurrentBatBuffer()
    const free = bat.readUInt16BE(0x06)
    expect(free).toBeGreaterThan(0)
    expect(free).toBeLessThanOrEqual(loaded.card.maxBlock - 5)
  })
})
