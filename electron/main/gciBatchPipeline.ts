import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { touchFileAccessAndModified, writeFileReplacingBirthtime } from './fileTimes'
import { dentryGameCodeString } from './gcmemcard/dentry'
import { MemCard2043Mb } from './gcmemcard/constants'
import { formatEmptyCard } from './gcmemcard/format'
import {
  gcTimestampSecondsFromUnixMs,
  importGcisIntoMemcardGreedy,
  MemcardImage,
} from './gcmemcard'
import { parseGciFile } from './gcmemcard/gci'
import { isGciProcessed, markGciProcessed } from './processedGciStore'
import { enqueuePendingSd } from './pendingSdQueue'
import type { MemcardUserSettings } from './userSettings'
import { organizeGciFolder } from './gciOrganizer'

export type BatchBuildOk = {
  ok: true
  outputs: { path: string; gameCode: string }[]
  errors: string[]
  /** Root recordings filed into opponent folders after the build. */
  organized?: { from: string; to: string; opponent: string }[]
}

export function resolveStagingDir(s: MemcardUserSettings): string {
  return s.stagingDir ?? path.join(app.getPath('userData'), 'staging')
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

  // Cheap pass first (stat only) so the periodic re-check doesn't read every file from Drive.
  const present: { absPath: string; mtimeMs: number }[] = []
  let anyNew = false
  for (const absPath of gciPaths) {
    if (s.gciPathOverrides[absPath] === 'exclude') continue
    let st
    try {
      st = await fs.stat(absPath)
    } catch {
      continue
    }
    present.push({ absPath, mtimeMs: st.mtimeMs })
    if (!(await isGciProcessed(absPath, st.mtimeMs))) anyNew = true
  }

  // Nothing new at the root since the last build: leave the staged card alone.
  if (present.length === 0 || !anyNew) {
    return { ok: true, outputs: [], errors: [] }
  }

  const candidates: Candidate[] = []
  for (const { absPath, mtimeMs } of present) {
    let buf: Buffer
    try {
      buf = await fs.readFile(absPath)
    } catch {
      continue
    }
    const parsed = parseGciFile(buf)
    if (!parsed.ok) continue
    candidates.push({ absPath, mtimeMs, gameCode: dentryGameCodeString(parsed.value.dentry) })
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

  // Newest first, with files pinned via the "include" override ahead of everything else.
  const pinned = (c: Candidate) => (s.gciPathOverrides[c.absPath] === 'include' ? 1 : 0)
  for (const list of byGame.values()) {
    list.sort((a, b) => pinned(b) - pinned(a) || b.mtimeMs - a.mtimeMs)
  }
  const cap = Math.max(1, s.maxReplaysPerCard)
  const organized: { from: string; to: string; opponent: string }[] = []

  const stagingDir = resolveStagingDir(s)
  const outputs: { path: string; gameCode: string }[] = []
  const errors: string[] = []

  await fs.mkdir(stagingDir, { recursive: true })

  for (const [gameCode, list] of byGame) {
    // Cap the card at a realistic working set instead of filling it: a nearly-full card makes
    // TM:CE complain about free space in-game.
    const selected = list.slice(0, cap)
    const paths = selected.map((c) => c.absPath)
    const rawPath = path.join(stagingDir, `${gameCode}.raw`)
    let marked: Candidate[] = []

    try {
      const gcSec = gcTimestampSecondsFromUnixMs(Date.now())
      const rawBuf = formatEmptyCard(MemCard2043Mb, gcSec)
      const cardLoad = MemcardImage.load(rawBuf)
      if (!cardLoad.ok) {
        errors.push(`${gameCode}: ${cardLoad.error}`)
        continue
      }
      const imp = await importGcisIntoMemcardGreedy(cardLoad.card, paths, {
        mTimeGcSeconds: gcSec,
        gciFilenameSanitize: s.gciFilenameSanitize,
      })
      if (!imp.ok) {
        errors.push(`${gameCode}: ${imp.error}`)
        continue
      }
      for (const w of imp.warnings) {
        errors.push(`${gameCode}: ${w}`)
      }
      const importedSet = new Set(imp.importedPaths)
      marked = selected.filter((c) => importedSet.has(c.absPath))
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

    // Mark the whole root set seen (not just what fit) so leftovers don't re-trigger builds.
    void marked
    await markGciProcessed(list.map((c) => ({ path: c.absPath, mtimeMs: c.mtimeMs })))
    const destName = `${gameCode}.raw`
    await enqueuePendingSd({ localPath: rawPath, fileName: destName })
    outputs.push({ path: rawPath, gameCode })

    if (gameCode === 'GTME' && s.autoOrganizeGcis) {
      const rest = list.slice(cap).filter((c) => s.gciPathOverrides[c.absPath] !== 'include')
      const r = await organizeGciFolder(gciFolder, rest, 0, s.mainCharacter)
      organized.push(...r.moves)
      errors.push(...r.errors)
    }
  }

  return { ok: true, outputs, errors, organized }
}
