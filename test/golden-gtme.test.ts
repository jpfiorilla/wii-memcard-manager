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

/** Slippi Dolphin MCM: bare GTME.raw + `dk-low-upB.gci` — target for import parity; do not edit */
export const GOLDEN_GTME_WITH_DK_PATH = join(__dirname, 'fixtures', 'golden', 'GTME-with-dk-low-upB.raw')

/** Slippi Nintendont MCM: `GTME.raw` + both DK `.gci` saves — see README */
export const GOLDEN_GTME_WITH_TWO_DK_PATH = join(
  __dirname,
  'fixtures',
  'golden',
  'GTME-with-two-DK-upB-gcis.raw',
)

/** SHA-256 of the exact bytes on disk — bump only when intentionally replacing the golden file */
const GOLDEN_GTME_SHA256 =
  'd8c5f81124fa262b0c026cc6eef9c1aa38336b5a3a823a6a0ee83d88cae651fa'

const GOLDEN_GTME_WITH_DK_SHA256 =
  '891b7fcf796905a5ef61058f9b144048265d06b2565d4d4e7fa3135f15d310a3'

const GOLDEN_GTME_WITH_TWO_DK_SHA256 =
  '1365d5961263d335c4b6b4b0bd14e4b2789890d3ea98fe212e6b01bdbe35b9c3'

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

describe('golden GTME-with-dk-low-upB.raw (Slippi Dolphin MCM reference)', () => {
  function readPaired(): Buffer {
    return readFileSync(GOLDEN_GTME_WITH_DK_PATH)
  }

  it('fixture matches recorded SHA-256', () => {
    const hash = createHash('sha256').update(readPaired()).digest('hex')
    expect(hash).toBe(GOLDEN_GTME_WITH_DK_SHA256)
  })

  it('loads and round-trips bytes without mutation', () => {
    const original = readPaired()
    const loaded = MemcardImage.load(original)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.card.toBuffer().equals(original)).toBe(true)
  })

  it('has more directory entries than bare GTME (DK save added)', () => {
    const bareLoad = MemcardImage.load(readGoldenGtme())
    const pairedLoad = MemcardImage.load(readPaired())
    expect(bareLoad.ok).toBe(true)
    expect(pairedLoad.ok).toBe(true)
    if (!bareLoad.ok || !pairedLoad.ok) return
    const bare = countDirFiles(bareLoad.card.getCurrentDirBuffer())
    const paired = countDirFiles(pairedLoad.card.getCurrentDirBuffer())
    expect(paired).toBeGreaterThan(bare)
    expect(paired).toBeLessThan(DIRLEN)
  })
})

describe('golden GTME-with-two-DK-upB-gcis.raw (Slippi Nintendont MCM reference)', () => {
  function readTriple(): Buffer {
    return readFileSync(GOLDEN_GTME_WITH_TWO_DK_PATH)
  }

  it('fixture matches recorded SHA-256', () => {
    const hash = createHash('sha256').update(readTriple()).digest('hex')
    expect(hash).toBe(GOLDEN_GTME_WITH_TWO_DK_SHA256)
  })

  it('loads and round-trips bytes without mutation', () => {
    const original = readTriple()
    const loaded = MemcardImage.load(original)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.card.toBuffer().equals(original)).toBe(true)
  })

  it('has two more TM:CE replay saves than bare GTME (dk-low + dk-high)', () => {
    const bareLoad = MemcardImage.load(readGoldenGtme())
    const tripleLoad = MemcardImage.load(readTriple())
    expect(bareLoad.ok).toBe(true)
    expect(tripleLoad.ok).toBe(true)
    if (!bareLoad.ok || !tripleLoad.ok) return
    const bare = countDirFiles(bareLoad.card.getCurrentDirBuffer())
    const triple = countDirFiles(tripleLoad.card.getCurrentDirBuffer())
    expect(triple).toBe(bare + 2)
  })
})
