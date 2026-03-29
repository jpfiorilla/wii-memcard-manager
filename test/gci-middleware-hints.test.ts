import { describe, expect, it } from 'vitest'
import { DENTRY_SIZE, GCI_FILENAME_TMCE_MAX_BYTES } from '../electron/main/gcmemcard/constants'
import { describeGciDentry } from '../electron/main/gcmemcard/gciCharacterHints'
import { MeleeExternalCharacterId } from '../electron/main/gcmemcard/meleeCharacterIds'
import {
  clampGciFilenameLatin1,
  normalizeGciFilenameAscii,
  normalizeGciFilenameTmceShort,
  prepareDentryForImport,
} from '../electron/main/gcmemcard/gciWriteMiddleware'
import { filenameString } from '../electron/main/gcmemcard/dentry'

function dentryGtmeFilename(fn: string): Buffer {
  const dentry = Buffer.alloc(DENTRY_SIZE, 0)
  Buffer.from('GTME', 'ascii').copy(dentry, 0)
  Buffer.from('01', 'ascii').copy(dentry, 4)
  Buffer.from(fn.padEnd(0x20, '\0').slice(0, 0x20), 'latin1').copy(dentry, 8)
  return dentry
}

describe('gciWriteMiddleware', () => {
  it('normalizeGciFilenameAscii title-cases hyphen segments', () => {
    expect(normalizeGciFilenameAscii('dk-low-upB', 'ascii-title')).toBe('Dk-Low-Upb')
  })

  it('prepareDentryForImport rewrites dentry filename when style is not none', () => {
    const d = dentryGtmeFilename('dk-low-upB')
    const out = prepareDentryForImport(d, { gciFilenameSanitize: 'ascii-title' })
    expect(filenameString(out)).toBe('Dk-Low-Upb')
  })

  it('prepareDentryForImport leaves dentry unchanged for none', () => {
    const d = dentryGtmeFilename('dk-low-upB')
    const out = prepareDentryForImport(d, { gciFilenameSanitize: 'none' })
    expect(filenameString(out)).toBe('dk-low-upB')
  })

  it('normalizeGciFilenameTmceShort uses short slugs and zelda → sheik', () => {
    expect(normalizeGciFilenameTmceShort('dk-low-upB')).toBe('dk-low-upb')
    expect(normalizeGciFilenameTmceShort('zelda-low-upB')).toBe('sheik-low-upb')
  })

  it('clampGciFilenameLatin1 never exceeds TM:CE cap', () => {
    const long = 'a'.repeat(40)
    expect(clampGciFilenameLatin1(long, GCI_FILENAME_TMCE_MAX_BYTES).length).toBe(
      GCI_FILENAME_TMCE_MAX_BYTES,
    )
  })

  it('prepareDentryForImport tmce-short clamps long names', () => {
    const longName = `${'mario-low-'.repeat(8)}x`
    const d = dentryGtmeFilename(longName.slice(0, 32))
    const out = prepareDentryForImport(d, { gciFilenameSanitize: 'tmce-short' })
    expect(filenameString(out).length).toBeLessThanOrEqual(GCI_FILENAME_TMCE_MAX_BYTES)
  })
})

describe('describeGciDentry', () => {
  it('infers DK from GTME slug-style filename', () => {
    const d = dentryGtmeFilename('dk-low-upB')
    const desc = describeGciDentry(d)
    expect(desc.gameCode).toBe('GTME')
    expect(desc.meleeCharacterFromFilename).toBe(MeleeExternalCharacterId.DonkeyKong)
  })

  it('does not infer character when slug is unknown', () => {
    const d = dentryGtmeFilename('zzz-low-upB')
    const desc = describeGciDentry(d)
    expect(desc.meleeCharacterFromFilename).toBeUndefined()
  })

  it('treats zelda filename slug as Sheik', () => {
    const d = dentryGtmeFilename('zelda-low-upB')
    const desc = describeGciDentry(d)
    expect(desc.meleeCharacterFromFilename).toBe(MeleeExternalCharacterId.Sheik)
  })
})
