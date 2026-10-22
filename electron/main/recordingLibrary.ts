/**
 * Everything in the recordings folder that can go on a card: TM:CE recordings (root and subfolders
 * like `Falco/`, plus `archive/` when asked) with their opponent, and the game's own save.
 *
 * Reading a .gci from Google Drive is slow, so what each file holds is cached by path + mtime in
 * `recording-index.json`; the once-a-minute re-check then only lists and stats the folder.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { dentryGameCodeString, filenameString } from './gcmemcard/dentry'
import { parseGciFile } from './gcmemcard/gci'
import { decodeTmceExportHeader, opponentOf } from './gcmemcard/tmceExportHeader'
import type { Recording } from './playlists'

type Indexed = {
  mtimeMs: number
  gameCode: string | null
  saveName: string
  /** Characters from the TM:CE header (null when unreadable). */
  hmn: number | null
  cpu: number | null
}

export type GameSave = { path: string; mtimeMs: number; saveName: string }

export type Library = {
  recordings: Recording[]
  /** Newest copy of each game save (not a recording); always goes on the card. */
  gameSaves: GameSave[]
  archiveCount: number
}

const MAX_DEPTH = 3
const isArchiveDir = (name: string) => name.toLowerCase() === 'archive'
const isSkippedDir = (name: string) => name.startsWith('.') || name.toLowerCase() === 'backups'

let index: Map<string, Indexed> | null = null
let indexDirty = false
const indexFile = () => path.join(app.getPath('userData'), 'recording-index.json')

async function loadIndex(): Promise<Map<string, Indexed>> {
  if (index) return index
  try {
    index = new Map(Object.entries(JSON.parse(await fs.readFile(indexFile(), 'utf-8')) as Record<string, Indexed>))
  } catch {
    index = new Map()
  }
  return index
}

async function saveIndex() {
  if (!index || !indexDirty) return
  indexDirty = false
  try {
    await fs.writeFile(indexFile(), JSON.stringify(Object.fromEntries(index)), 'utf-8')
  } catch (e) {
    console.warn('[library] could not save recording-index.json', e)
  }
}

async function listGcis(dir: string, depth: number, inArchive: boolean, out: { path: string; inArchive: boolean }[]) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (depth >= MAX_DEPTH || isSkippedDir(e.name)) continue
      await listGcis(p, depth + 1, inArchive || isArchiveDir(e.name), out)
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.gci') && !e.name.startsWith('.')) {
      out.push({ path: p, inArchive })
    }
  }
}

async function describe(file: string, mtimeMs: number): Promise<Indexed> {
  const buf = await fs.readFile(file)
  const parsed = parseGciFile(buf)
  if (!parsed.ok) return { mtimeMs, gameCode: null, saveName: '', hmn: null, cpu: null }
  const h = decodeTmceExportHeader(buf)
  return {
    mtimeMs,
    gameCode: dentryGameCodeString(parsed.value.dentry),
    saveName: filenameString(parsed.value.dentry),
    hmn: h?.hmn ?? null,
    cpu: h?.cpu ?? null,
  }
}

export async function scanLibrary(
  root: string,
  opts: { includeArchive: boolean; mainCharacter: number; gameCode: string; onStep?: (s: string) => void },
): Promise<Library> {
  const idx = await loadIndex()
  const found: { path: string; inArchive: boolean }[] = []
  await listGcis(root, 0, false, found)

  const recordings: Recording[] = []
  const saves = new Map<string, GameSave>()
  let archiveCount = 0
  let read = 0
  for (const f of found) {
    let st
    try {
      st = await fs.stat(f.path)
    } catch {
      continue
    }
    let info = idx.get(f.path)
    if (!info || info.mtimeMs !== st.mtimeMs) {
      opts.onStep?.(`reading ${path.basename(f.path)} (${++read} new)`)
      try {
        info = await describe(f.path, st.mtimeMs)
      } catch {
        continue
      }
      idx.set(f.path, info)
      indexDirty = true
    }
    if (info.gameCode !== opts.gameCode) continue
    if (!info.saveName.startsWith('TMREC')) {
      const prev = saves.get(info.saveName)
      if (!prev || prev.mtimeMs < st.mtimeMs) saves.set(info.saveName, { path: f.path, mtimeMs: st.mtimeMs, saveName: info.saveName })
      continue
    }
    if (f.inArchive) {
      archiveCount++
      if (!opts.includeArchive) continue
    }
    const opponent =
      info.hmn === null || info.cpu === null
        ? null
        : opponentOf({ hmn: info.hmn, cpu: info.cpu }, opts.mainCharacter)
    recordings.push({ path: f.path, name: path.basename(f.path).replace(/\.gci$/i, ''), mtimeMs: st.mtimeMs, opponent })
  }

  // Forget files that are gone so the index doesn't grow forever.
  const present = new Set(found.map((f) => f.path))
  for (const k of idx.keys()) {
    if (!present.has(k) && k.startsWith(root)) {
      idx.delete(k)
      indexDirty = true
    }
  }
  if (read > 0) console.log(`[library] read ${read} new or changed file(s) under ${root}`)
  await saveIndex()
  return { recordings, gameSaves: [...saves.values()], archiveCount }
}
