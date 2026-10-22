import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CKIND_MARTH,
  ckindName,
  decodeTmceExportHeader,
  opponentOf,
} from '../electron/main/gcmemcard/tmceExportHeader'
import { planOrganize } from '../electron/main/gciOrganizer'
import { GOLDEN_DK_HIGH_UPB_GCI_PATH, GOLDEN_DK_LOW_UPB_GCI_PATH } from './golden-dk-gci.test'

describe('decodeTmceExportHeader', () => {
  it('reads characters, stage and name from a TM:CE recording', () => {
    const h = decodeTmceExportHeader(readFileSync(GOLDEN_DK_LOW_UPB_GCI_PATH))
    expect(h).not.toBeNull()
    expect(ckindName(h!.hmn)).toBe('Marth')
    expect(ckindName(h!.cpu)).toBe('DK')
    expect(h!.name).toBe('DK low upB')
    expect(h!.stageExternal).toBe(31)
    expect(opponentOf(h!, CKIND_MARTH)).toBe(1)
  })

  it('decodes the second fixture too', () => {
    const h = decodeTmceExportHeader(readFileSync(GOLDEN_DK_HIGH_UPB_GCI_PATH))
    expect(h?.name).toBe('DK high upB')
  })

  it('rejects corrupted data via the checksum', () => {
    const buf = Buffer.from(readFileSync(GOLDEN_DK_LOW_UPB_GCI_PATH))
    buf[0x1eb0 + 100] ^= 0xff
    expect(decodeTmceExportHeader(buf)).toBeNull()
  })

  it('uses the human as opponent when the recording has Marth as CPU', () => {
    const h = decodeTmceExportHeader(readFileSync(GOLDEN_DK_LOW_UPB_GCI_PATH))!
    expect(opponentOf({ ...h, hmn: 20, cpu: CKIND_MARTH }, CKIND_MARTH)).toBe(20)
  })
})

describe('planOrganize', () => {
  it('keeps the newest N at the root and files the rest by opponent', () => {
    const gcis = [1, 2, 3, 4].map((n) => ({ absPath: `/c/${n}.gci`, mtimeMs: n }))
    const headers = new Map<string, { opponent: number } | null>([
      ['/c/1.gci', { opponent: 20 }],
      ['/c/2.gci', null],
    ])
    expect(planOrganize(gcis, headers, 2)).toEqual([{ absPath: '/c/1.gci', folder: 'Falco' }])
  })
})
