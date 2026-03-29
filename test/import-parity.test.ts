import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DENTRY_SIZE, DIRLEN } from '../electron/main/gcmemcard/constants'
import { filenameString, isDentryEmpty, readDEntry } from '../electron/main/gcmemcard/dentry'
import { parseGciFile } from '../electron/main/gcmemcard/gci'
import { MemcardImage } from '../electron/main/gcmemcard/memcardImage'

const __dirname = dirname(fileURLToPath(import.meta.url))
const goldenDir = join(__dirname, 'fixtures', 'golden')

function listSaveFilenames(dirBlock: Buffer): string[] {
  const out: string[] = []
  for (let i = 0; i < DIRLEN; i++) {
    const d = readDEntry(dirBlock, i * DENTRY_SIZE)
    if (!isDentryEmpty(d)) out.push(filenameString(d))
  }
  return out
}

/**
 * Parity vs Slippi memory card managers — see `test/fixtures/golden/README.md`.
 * Single-GCI import is byte-identical to Dolphin MCM; two-GCI import is compared on directory filenames
 * (full image bytes still differ from Slippy Nintendont MCM — BAT / block chains).
 */
describe('import parity vs Slippi Dolphin MCM', () => {
  it('our import into bare GTME.raw matches golden GTME-with-dk-low-upB.raw', () => {
    const base = readFileSync(join(goldenDir, 'GTME.raw'))
    const expected = readFileSync(join(goldenDir, 'GTME-with-dk-low-upB.raw'))
    const gci = readFileSync(join(goldenDir, 'dk-low-upB.gci'))

    const parsed = parseGciFile(gci)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const loaded = MemcardImage.load(Buffer.from(base))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const code = loaded.card.importSave(parsed.value.dentry, parsed.value.blocks)
    expect(code).toBe('SUCCESS')

    const out = loaded.card.toBuffer()
    expect(out.equals(expected)).toBe(true)
  })

  it('our two-step import (dk-low then dk-high) matches Slippy directory listing (GTME-with-two-DK-upB-gcis.raw)', () => {
    const base = readFileSync(join(goldenDir, 'GTME.raw'))
    const slippyRef = readFileSync(join(goldenDir, 'GTME-with-two-DK-upB-gcis.raw'))
    const gciLow = readFileSync(join(goldenDir, 'dk-low-upB.gci'))
    const gciHigh = readFileSync(join(goldenDir, 'dk-high-upB.gci'))

    const parsedLow = parseGciFile(gciLow)
    const parsedHigh = parseGciFile(gciHigh)
    expect(parsedLow.ok).toBe(true)
    expect(parsedHigh.ok).toBe(true)
    if (!parsedLow.ok || !parsedHigh.ok) return

    const loaded = MemcardImage.load(Buffer.from(base))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    expect(loaded.card.importSave(parsedLow.value.dentry, parsedLow.value.blocks)).toBe('SUCCESS')
    expect(loaded.card.importSave(parsedHigh.value.dentry, parsedHigh.value.blocks)).toBe('SUCCESS')

    const refLoad = MemcardImage.load(Buffer.from(slippyRef))
    expect(refLoad.ok).toBe(true)
    if (!refLoad.ok) return

    const ours = listSaveFilenames(loaded.card.getCurrentDirBuffer()).sort()
    const theirs = listSaveFilenames(refLoad.card.getCurrentDirBuffer()).sort()
    expect(ours).toEqual(theirs)
  })
})
