import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { touchFileAccessAndModified, writeFileReplacingBirthtime } from './fileTimes'
import { dentryGameCodeString } from './gcmemcard/dentry'
import { MemCard2043Mb } from './gcmemcard/constants'
import { formatEmptyCard } from './gcmemcard/format'
import { gcTimestampSecondsFromUnixMs, importGcisIntoMemcard, MemcardImage } from './gcmemcard'
import { parseGciFile } from './gcmemcard/gci'
import { isGciProcessed, markGciProcessed } from './processedGciStore'
import { enqueuePendingSd } from './pendingSdQueue'
import type { MemcardUserSettings } from './userSettings'

export type BatchBuildOk = {
  ok: true
  outputs: { path: string; gameCode: string }[]
  errors: string[]
}

export function resolveStagingDir(s: MemcardUserSettings): string {
  return s.stagingDir ?? path.join(app.getPath('userData'), 'staging')
}

async function uniqueStagingRawPath(stagingDir: string, gameCode: string): Promise<string> {
  await fs.mkdir(stagingDir, { recursive: true })
  const base = `${gameCode}.raw`
  const primary = path.join(stagingDir, base)
  try {
    await fs.access(primary)
    return path.join(stagingDir, `${gameCode}-${Date.now()}.raw`)
  } catch {
    return primary
  }
}

type Candidate = {
  absPath: string
  mtimeMs: number
  gameCode: string
}

export async function runGciBatchBuild(s: MemcardUserSettings): Promise<BatchBuildOk | { ok: false; error: string }> {
  if (!s.gciFolder || !s.autoBuildRaw) {
    return { ok: true, outputs: [], errors: [] }
  }

  const gciFolder = s.gciFolder
  let dirents
  try {
    dirents = await fs.readdir(gciFolder, { withFileTypes: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }

  const gciPaths = dirents
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.gci'))
    .map((e) => path.join(gciFolder, e.name))

  const candidates: Candidate[] = []

  for (const absPath of gciPaths) {
    let st
    try {
      st = await fs.stat(absPath)
    } catch {
      continue
    }
    const mtimeMs = st.mtimeMs
    if (await isGciProcessed(absPath, mtimeMs)) continue

    let buf: Buffer
    try {
      buf = await fs.readFile(absPath)
    } catch {
      continue
    }

    const parsed = parseGciFile(buf)
    if (!parsed.ok) continue

    const gameCode = dentryGameCodeString(parsed.value.dentry)
    candidates.push({ absPath, mtimeMs, gameCode })
  }

  if (candidates.length === 0) {
    return { ok: true, outputs: [], errors: [] }
  }

  const byGame = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const list = byGame.get(c.gameCode) ?? []
    list.push(c)
    byGame.set(c.gameCode, list)
  }

  for (const list of byGame.values()) {
    list.sort((a, b) => b.mtimeMs - a.mtimeMs)
  }

  const stagingDir = resolveStagingDir(s)
  const outputs: { path: string; gameCode: string }[] = []
  const errors: string[] = []

  for (const [gameCode, list] of byGame) {
    const paths = list.map((c) => c.absPath)
    const rawPath = await uniqueStagingRawPath(stagingDir, gameCode)

    try {
      const gcSec = gcTimestampSecondsFromUnixMs(Date.now())
      const rawBuf = formatEmptyCard(MemCard2043Mb, gcSec)
      const cardLoad = MemcardImage.load(rawBuf)
      if (!cardLoad.ok) {
        errors.push(`${gameCode}: ${cardLoad.error}`)
        continue
      }
      const imp = await importGcisIntoMemcard(cardLoad.card, paths, { mTimeGcSeconds: gcSec })
      if (!imp.ok) {
        errors.push(`${gameCode}: ${imp.error}`)
        continue
      }
      await writeFileReplacingBirthtime(rawPath, cardLoad.card.toBuffer())
      await touchFileAccessAndModified(rawPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${gameCode}: ${msg}`)
      try {
        await fs.unlink(rawPath)
      } catch {
        /* ignore */
      }
      continue
    }

    await markGciProcessed(list.map((c) => ({ path: c.absPath, mtimeMs: c.mtimeMs })))
    const destName = `${gameCode}.raw`
    await enqueuePendingSd({ localPath: rawPath, fileName: destName })
    outputs.push({ path: rawPath, gameCode })
  }

  return { ok: true, outputs, errors }
}
