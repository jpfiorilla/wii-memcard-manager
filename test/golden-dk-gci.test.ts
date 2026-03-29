import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DENTRY_SIZE } from '../electron/main/gcmemcard/constants'
import { parseGciFile } from '../electron/main/gcmemcard/gci'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Slippi / rwing-exported replay-adjacent GCI — do not edit; see test/fixtures/golden/README.md
 * On disk as `dk low upB.gci`; stored here as `dk-low-upB.gci` (no spaces).
 */
export const GOLDEN_DK_LOW_UPB_GCI_PATH = join(__dirname, 'fixtures', 'golden', 'dk-low-upB.gci')

export const GOLDEN_DK_HIGH_UPB_GCI_PATH = join(__dirname, 'fixtures', 'golden', 'dk-high-upB.gci')

const GOLDEN_DK_LOW_UPB_GCI_SHA256 =
  'd964e92d7a8d469dbc139905223ced565e4f00503484bbaf68eefb7ee68e02df'

const GOLDEN_DK_HIGH_UPB_GCI_SHA256 =
  '76dea18752aaeb032a00ba0558de1f2a71ce69431aa21886db685e2a9ce35e30'

function readGoldenDkGci(): Buffer {
  return readFileSync(GOLDEN_DK_LOW_UPB_GCI_PATH)
}

function readGoldenDkHighGci(): Buffer {
  return readFileSync(GOLDEN_DK_HIGH_UPB_GCI_PATH)
}

describe('golden dk-low-upB.gci (rwing / Slippi family export)', () => {
  it('fixture exists and matches recorded SHA-256', () => {
    const buf = readGoldenDkGci()
    expect(createHash('sha256').update(buf).digest('hex')).toBe(GOLDEN_DK_LOW_UPB_GCI_SHA256)
  })

  it('parses as a valid GCI (GTME, 4 blocks)', () => {
    const buf = readGoldenDkGci()
    expect(buf.length).toBe(DENTRY_SIZE + 4 * 8192)

    const parsed = parseGciFile(buf)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.value.dentry.toString('ascii', 0, 4)).toBe('GTME')
    expect(parsed.value.dentry.readUInt16BE(0x38)).toBe(4)
    expect(parsed.value.blocks.length).toBe(4)
  })
})

describe('golden dk-high-upB.gci (rwing / Slippi family export)', () => {
  it('fixture exists and matches recorded SHA-256', () => {
    const buf = readGoldenDkHighGci()
    expect(createHash('sha256').update(buf).digest('hex')).toBe(GOLDEN_DK_HIGH_UPB_GCI_SHA256)
  })

  it('parses as a valid GCI (GTME, 4 blocks)', () => {
    const buf = readGoldenDkHighGci()
    expect(buf.length).toBe(DENTRY_SIZE + 4 * 8192)

    const parsed = parseGciFile(buf)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.value.dentry.toString('ascii', 0, 4)).toBe('GTME')
    expect(parsed.value.dentry.readUInt16BE(0x38)).toBe(4)
    expect(parsed.value.blocks.length).toBe(4)
  })
})
