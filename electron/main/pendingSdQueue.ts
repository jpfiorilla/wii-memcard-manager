import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

const FILE_NAME = 'pending-sd-queue.json'

export type PendingSdItem = {
  localPath: string
  /** Basename on SD, e.g. GTME.raw */
  fileName: string
}

type StoreShape = {
  items: PendingSdItem[]
}

function storePath(): string {
  return path.join(app.getPath('userData'), FILE_NAME)
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoreShape>
    if (Array.isArray(parsed.items)) {
      return { items: parsed.items.filter((i) => i && typeof i.localPath === 'string' && typeof i.fileName === 'string') }
    }
  } catch {
    /* empty */
  }
  return { items: [] }
}

async function writeStore(s: StoreShape): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify(s, null, 2), 'utf-8')
}

export async function enqueuePendingSd(item: PendingSdItem): Promise<void> {
  const s = await readStore()
  s.items = s.items.filter((i) => i.fileName !== item.fileName)
  s.items.push(item)
  await writeStore(s)
}

export async function dequeuePendingSd(): Promise<PendingSdItem | null> {
  const s = await readStore()
  const first = s.items.shift()
  if (first) await writeStore(s)
  return first ?? null
}

export async function peekPendingSdAll(): Promise<PendingSdItem[]> {
  const s = await readStore()
  return [...s.items]
}

export async function removePendingByLocalPath(localPath: string): Promise<void> {
  const s = await readStore()
  s.items = s.items.filter((i) => i.localPath !== localPath)
  await writeStore(s)
}

export async function clearPendingQueue(): Promise<void> {
  await writeStore({ items: [] })
}
