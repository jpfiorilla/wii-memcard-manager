import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

const FILE_NAME = 'processed-gci.json'

type StoreShape = {
  /** Absolute path -> mtimeMs when that file was included in a built .raw */
  entries: Record<string, number>
}

function storePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME)
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoreShape>
    if (parsed.entries && typeof parsed.entries === 'object') {
      return { entries: parsed.entries as Record<string, number> }
    }
  } catch {
    /* empty */
  }
  return { entries: {} }
}

async function writeStore(s: StoreShape): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify(s, null, 2), 'utf-8')
}

export async function isGciProcessed(absPath: string, mtimeMs: number): Promise<boolean> {
  const s = await readStore()
  const prev = s.entries[absPath]
  return prev !== undefined && prev === mtimeMs
}

export async function markGciProcessed(pathsAndMtimes: { path: string; mtimeMs: number }[]): Promise<void> {
  const s = await readStore()
  for (const { path: p, mtimeMs } of pathsAndMtimes) {
    s.entries[p] = mtimeMs
  }
  await writeStore(s)
}

export async function clearProcessedStore(): Promise<void> {
  await writeStore({ entries: {} })
}
