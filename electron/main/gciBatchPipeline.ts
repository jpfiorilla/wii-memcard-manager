import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { touchFileAccessAndModified, writeFileReplacingBirthtime } from './fileTimes'
import { dentryGameCodeString, filenameString } from './gcmemcard/dentry'
import { BLOCK_SIZE, MBIT_TO_BLOCKS, MemCard251Mb } from './gcmemcard/constants'

/**
 * Build cards at Nintendont's default 251-block (2 MiB) size. Nintendont sizes its emulated card
 * from its own settings, not the file, and TM:CE hangs (e.g. entering Training Lab) when handed a
 * card of a different size. 25 recordings (~4 blocks each) plus the TM save fit easily.
 */
export const CARD_SIZE_MB = MemCard251Mb
const CARD_BYTES = CARD_SIZE_MB * MBIT_TO_BLOCKS * BLOCK_SIZE
/** Only Training Mode cards are built/served; other games' saves in the folder are ignored. */
export const BUILD_GAMES = new Set(['GTME'])
/** Bump when card contents rules change so existing staged cards get rebuilt (2: include game save). */
const BUILD_FORMAT = 2
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
import { applyCardHeader, loadCardHeader, patchCardFile } from './cardHeaders'

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
  /** Card filename from the GCI (e.g. TMREC_... for TM:CE recordings, or the game's own save). */
  saveName: string
}

/** TM:CE recordings are named TMREC_*; anything else is the game's own save (settings/progress). */
const isRecording = (c: Candidate) => c.saveName.startsWith('TMREC')

let lastSummary: string | null = null

export async function runGciBatchBuild(s: MemcardUserSettings): Promise<BatchBuildOk | { ok: false; error: string }> {
  if (!s.gciFolder || !s.autoBuildRaw) {
    console.log(`[batch] skipped: gciFolder=${s.gciFolder ?? 'none'} autoBuildRaw=${s.autoBuildRaw}`)
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

  if (!lastSummary || lastSummary !== `${present.length}:${anyNew}`) {
    // Logged only when it changes, so the once-a-minute re-check stays quiet.
    lastSummary = `${present.length}:${anyNew}`
    console.log(`[batch] ${present.length} recordings at the root of ${gciFolder}; new since last build: ${anyNew}`)
  }

  // A staged card from an older build at the wrong size must be rebuilt even with nothing new.
  for (const game of BUILD_GAMES) {
    await patchCardFile(game, path.join(resolveStagingDir(s), `${game}.raw`))
    try {
      const meta = JSON.parse(await fs.readFile(path.join(resolveStagingDir(s), `${game}.build.json`), 'utf-8'))
      if (meta.format !== BUILD_FORMAT) throw new Error('old format')
    } catch {
      if (!anyNew) console.log(`[batch] staged ${game}.raw was built by older rules; rebuilding`)
      anyNew = true
    }
    try {
      const st = await fs.stat(path.join(resolveStagingDir(s), `${game}.raw`))
      if (st.size !== CARD_BYTES) {
        console.log(`[batch] staged ${game}.raw is ${st.size} bytes, expected ${CARD_BYTES}; rebuilding`)
        anyNew = true
      }
    } catch {
      /* not built yet */
    }
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
    const gameCode = dentryGameCodeString(parsed.value.dentry)
    if (!BUILD_GAMES.has(gameCode)) continue
    candidates.push({ absPath, mtimeMs, gameCode, saveName: filenameString(parsed.value.dentry) })
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
    // The game's own save always goes on (newest copy per filename) and doesn't count toward the
    // cap; without it TM:CE asks to create save data on every boot.
    const gameSaves: Candidate[] = []
    for (const c of list.filter((c) => !isRecording(c))) {
      if (!gameSaves.some((g) => g.saveName === c.saveName)) gameSaves.push(c)
    }
    const recordings = list.filter(isRecording)
    const selected = [...gameSaves, ...recordings.slice(0, cap)]
    const paths = selected.map((c) => c.absPath)
    const rawPath = path.join(stagingDir, `${gameCode}.raw`)
    let marked: Candidate[] = []

    try {
      const gcSec = gcTimestampSecondsFromUnixMs(Date.now())
      const rawBuf = formatEmptyCard(CARD_SIZE_MB, gcSec)
      const header = await loadCardHeader(gameCode)
      if (applyCardHeader(rawBuf, header)) {
        console.log(`[batch] ${gameCode}: using the Wii card's header (serial ${header!.subarray(0, 12).toString('hex')})`)
      } else if (!header) {
        console.warn(`[batch] ${gameCode}: no Wii card header captured yet - plug the Wii's SD card into the Mac once`)
      }
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
    console.log(
      `[batch] built ${rawPath}: ${gameSaves.length} game save(s) + ${marked.length - gameSaves.length}/${selected.length - gameSaves.length} recordings`,
    )
    await fs.writeFile(path.join(stagingDir, `${gameCode}.build.json`), JSON.stringify({ format: BUILD_FORMAT }))
    await enqueuePendingSd({ localPath: rawPath, fileName: destName })
    outputs.push({ path: rawPath, gameCode })

    if (gameCode === 'GTME' && s.autoOrganizeGcis) {
      const rest = recordings.slice(cap).filter((c) => s.gciPathOverrides[c.absPath] !== 'include')
      const r = await organizeGciFolder(gciFolder, rest, 0, s.mainCharacter)
      organized.push(...r.moves)
      errors.push(...r.errors)
    }
  }

  return { ok: true, outputs, errors, organized }
}
