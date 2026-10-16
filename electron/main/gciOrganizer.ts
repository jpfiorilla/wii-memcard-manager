import fs from 'node:fs/promises'
import path from 'node:path'
import { ckindName, decodeTmceExportHeader, opponentOf } from './gcmemcard/tmceExportHeader'

/**
 * Keep the GCI folder's root as the working set: the newest `keep` recordings stay at the root
 * (they are what goes on the card), and older TM:CE recordings are filed into a folder named after
 * the opponent (e.g. `Falco/`). Files that can't be decoded are left where they are. Never deletes;
 * every move is appended to `.organize-log.jsonl` in the folder so it can be undone.
 */

export type OrganizeMove = { from: string; to: string; opponent: string }

export type RootGci = { absPath: string; mtimeMs: number }

/** Pure planning step (unit-tested): which root files move where. */
export function planOrganize(
  rootGcis: RootGci[],
  headers: Map<string, { opponent: number } | null>,
  keep: number,
): { absPath: string; folder: string }[] {
  const sorted = [...rootGcis].sort((a, b) => b.mtimeMs - a.mtimeMs)
  const plan: { absPath: string; folder: string }[] = []
  for (const g of sorted.slice(Math.max(0, keep))) {
    const h = headers.get(g.absPath)
    if (!h) continue
    const name = ckindName(h.opponent)
    if (!name) continue
    plan.push({ absPath: g.absPath, folder: name })
  }
  return plan
}

async function uniqueDest(dir: string, base: string): Promise<string> {
  const ext = path.extname(base)
  const stem = base.slice(0, base.length - ext.length)
  for (let i = 1; ; i++) {
    const candidate = path.join(dir, i === 1 ? base : `${stem} (${i})${ext}`)
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
  }
}

export async function organizeGciFolder(
  gciFolder: string,
  rootGcis: RootGci[],
  keep: number,
  mainCharacter: number,
): Promise<{ moves: OrganizeMove[]; errors: string[] }> {
  const headers = new Map<string, { opponent: number } | null>()
  const sorted = [...rootGcis].sort((a, b) => b.mtimeMs - a.mtimeMs)
  for (const g of sorted.slice(Math.max(0, keep))) {
    try {
      const h = decodeTmceExportHeader(await fs.readFile(g.absPath))
      headers.set(g.absPath, h ? { opponent: opponentOf(h, mainCharacter) } : null)
    } catch {
      headers.set(g.absPath, null)
    }
  }

  const moves: OrganizeMove[] = []
  const errors: string[] = []
  for (const p of planOrganize(rootGcis, headers, keep)) {
    try {
      const dir = path.join(gciFolder, p.folder)
      await fs.mkdir(dir, { recursive: true })
      const dest = await uniqueDest(dir, path.basename(p.absPath))
      await fs.rename(p.absPath, dest)
      moves.push({ from: p.absPath, to: dest, opponent: p.folder })
    } catch (e) {
      errors.push(`organize ${path.basename(p.absPath)}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (moves.length > 0) {
    const at = new Date().toISOString()
    const lines = moves.map((m) => JSON.stringify({ at, ...m })).join('\n') + '\n'
    try {
      await fs.appendFile(path.join(gciFolder, '.organize-log.jsonl'), lines, 'utf-8')
    } catch {
      /* log is best-effort */
    }
  }
  return { moves, errors }
}
