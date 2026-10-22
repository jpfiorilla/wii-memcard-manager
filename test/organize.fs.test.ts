import { mkdtempSync, copyFileSync, utimesSync, readdirSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { organizeGciFolder } from '../electron/main/gciOrganizer'
import { GOLDEN_DK_LOW_UPB_GCI_PATH } from './golden-dk-gci.test'
it('moves old recordings into opponent folders and logs', async () => {
  const d = mkdtempSync(join(tmpdir(), 'card-'))
  const files = ['a.gci', 'b.gci', 'c.gci'].map((n, i) => { const p = join(d, n); copyFileSync(GOLDEN_DK_LOW_UPB_GCI_PATH, p); utimesSync(p, i + 1, i + 1); return { absPath: p, mtimeMs: (i + 1) * 1000 } })
  const r = await organizeGciFolder(d, files, 2, 9)
  expect(r.errors).toEqual([])
  expect(readdirSync(join(d, 'DK'))).toEqual(['a.gci'])
  expect(existsSync(join(d, 'c.gci'))).toBe(true)
  expect(readFileSync(join(d, '.organize-log.jsonl'), 'utf8')).toContain('"opponent":"DK"')
})
