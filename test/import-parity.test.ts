import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MemcardImage } from '../electron/main/gcmemcard/memcardImage'
import { parseGciFile } from '../electron/main/gcmemcard/gci'

const __dirname = dirname(fileURLToPath(import.meta.url))
const goldenDir = join(__dirname, 'fixtures', 'golden')

/**
 * Parity: importing `dk-low-upB.gci` into a copy of bare `GTME.raw` must match
 * `GTME-with-dk-low-upB.raw` (Slippi Dolphin MCM). See `test/fixtures/golden/README.md`.
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
})
