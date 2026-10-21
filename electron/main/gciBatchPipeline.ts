import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { touchFileAccessAndModified, writeFileReplacingBirthtime } from './fileTimes'
import { createHash } from 'node:crypto'
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
/** Bump when card contents rules change so existing staged cards get rebuilt (3: playlists). */
const BUILD_FORMAT = 3
import { formatEmptyCard } from './gcmemcard/format'
import {
  gcTimestampSecondsFromUnixMs,
  importGcisIntoMemcardGreedy,
  MemcardImage,
} from './gcmemcard'
import { scanLibrary } from './recordingLibrary'
import { playlistName, resolvePlaylistId, selectRecordings } from './playlists'
import { ckindName } from './gcmemcard/tmceExportHeader'
import { enqueuePendingSd } from './pendingSdQueue'
import type { MemcardUserSettings } from './userSettings'
import { organizeGciFolder } from './gciOrganizer'
import { applyCardHeader, loadCardHeader, patchCardFile } from './cardHeaders'

export type BatchBuildOk = {
  ok: true
  outputs: { path: string; gameCode: string }[]
  errors: string[]
  /** Recordings filed into opponent folders after the build. */
  organized?: { from: string; to: string; opponent: string }[]
}

export function resolveStagingDir(s: MemcardUserSettings): string {
  return s.stagingDir ?? path.join(app.getPath('userData'), 'staging')
}

let lastSummary: string | null = null
/** What the current build is doing; reported by the watchdog if a build takes too long. */
export let batchStep = 'idle'
const step = (s: string) => {
  batchStep = s
}

const GAME = 'GTME'

/**
 * Build the staged GTME.raw from the active playlist. The card is only rewritten when what would go
 * on it changed (different files, newer copies, another playlist or shuffle), so the once-a-minute
 * re-check is cheap and the Wii only downloads a new card when there is one.
 */
export async function runGciBatchBuild(
  s: MemcardUserSettings,
): Promise<BatchBuildOk | { ok: false; error: string }> {
  if (!s.gciFolder || !s.autoBuildRaw) {
    console.log(`[batch] skipped: gciFolder=${s.gciFolder ?? 'none'} autoBuildRaw=${s.autoBuildRaw}`)
    return { ok: true, outputs: [], errors: [] }
  }
  const gciFolder = s.gciFolder
  try {
    await fs.access(gciFolder)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  step('scanning recordings')
  const lib = await scanLibrary(gciFolder, {
    includeArchive: s.includeArchive,
    mainCharacter: s.mainCharacter,
    gameCode: GAME,
    onStep: step,
  })
  const cap = Math.max(1, s.maxReplaysPerCard)
  const playlist = resolvePlaylistId(s.activePlaylist, s.customPlaylists)
  const name = playlistName(playlist, s.customPlaylists, ckindName)
  const picked = selectRecordings(lib.recordings, playlist, s.customPlaylists, cap, s.shuffleSeed)
  const selected = [...lib.gameSaves, ...picked]

  const summary = `${lib.recordings.length}:${playlist}:${picked.length}`
  if (lastSummary !== summary) {
    lastSummary = summary
    console.log(`[batch] ${lib.recordings.length} recordings in ${gciFolder}; playlist "${name}" picks ${picked.length}`)
  }
  if (selected.length === 0) {
    step('idle')
    return { ok: true, outputs: [], errors: [] }
  }

  const stagingDir = resolveStagingDir(s)
  const rawPath = path.join(stagingDir, `${GAME}.raw`)
  const metaPath = path.join(stagingDir, `${GAME}.build.json`)
  const signature = createHash('sha1')
    .update(JSON.stringify([BUILD_FORMAT, CARD_BYTES, selected.map((c) => [c.path, c.mtimeMs])]))
    .digest('hex')

  step(`patching staged ${GAME}.raw header`)
  await patchCardFile(GAME, rawPath)
  try {
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
    const st = await fs.stat(rawPath)
    if (meta.format === BUILD_FORMAT && meta.signature === signature && st.size === CARD_BYTES) {
      step('idle')
      return { ok: true, outputs: [], errors: [] }
    }
  } catch {
    /* never built, or built by older rules */
  }

  const errors: string[] = []
  await fs.mkdir(stagingDir, { recursive: true })
  const paths = selected.map((c) => c.path)
  let importedCount = 0
  try {
    const gcSec = gcTimestampSecondsFromUnixMs(Date.now())
    const rawBuf = formatEmptyCard(CARD_SIZE_MB, gcSec)
    const header = await loadCardHeader(GAME)
    if (applyCardHeader(rawBuf, header)) {
      console.log(`[batch] ${GAME}: using the Wii card's header (serial ${header!.subarray(0, 12).toString('hex')})`)
    } else if (!header) {
      console.warn(`[batch] ${GAME}: no Wii card header captured yet - plug the Wii's SD card into the Mac once`)
    }
    const cardLoad = MemcardImage.load(rawBuf)
    if (!cardLoad.ok) return { ok: false, error: `${GAME}: ${cardLoad.error}` }
    step(`importing ${paths.length} saves into ${GAME}.raw`)
    const imp = await importGcisIntoMemcardGreedy(cardLoad.card, paths, {
      mTimeGcSeconds: gcSec,
      gciFilenameSanitize: s.gciFilenameSanitize,
    })
    if (!imp.ok) return { ok: false, error: `${GAME}: ${imp.error}` }
    for (const w of imp.warnings) errors.push(`${GAME}: ${w}`)
    importedCount = imp.importedPaths.length
    await writeFileReplacingBirthtime(rawPath, cardLoad.card.toBuffer())
    await touchFileAccessAndModified(rawPath)
  } catch (e) {
    await fs.unlink(rawPath).catch(() => {})
    step('idle')
    return { ok: false, error: `${GAME}: ${e instanceof Error ? e.message : String(e)}` }
  }

  console.log(
    `[batch] built ${rawPath} from "${name}": ${lib.gameSaves.length} game save(s) + ${importedCount - lib.gameSaves.length}/${picked.length} recordings`,
  )
  await fs.writeFile(metaPath, JSON.stringify({ format: BUILD_FORMAT, signature, playlist, builtAt: new Date().toISOString() }))
  await enqueuePendingSd({ localPath: rawPath, fileName: `${GAME}.raw` })

  const organized: { from: string; to: string; opponent: string }[] = []
  if (s.autoOrganizeGcis) {
    // Root recordings that aren't on the card get filed by opponent; the card keeps working
    // because playlists read subfolders too.
    const onCard = new Set(picked.map((r) => r.path))
    const rest = lib.recordings
      .filter((r) => path.dirname(r.path) === gciFolder && !onCard.has(r.path))
      .map((r) => ({ absPath: r.path, mtimeMs: r.mtimeMs }))
    if (rest.length) {
      step('organizing recordings')
      const r = await organizeGciFolder(gciFolder, rest, 0, s.mainCharacter)
      organized.push(...r.moves)
      errors.push(...r.errors)
    }
  }

  step('idle')
  return { ok: true, outputs: [{ path: rawPath, gameCode: GAME }], errors, organized }
}
