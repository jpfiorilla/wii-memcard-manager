import fs from 'node:fs/promises'
import path from 'node:path'
import { filenameString } from './dentry'
import { parseGciFile } from './gci'
import { MemcardImage } from './memcardImage'

export type GciFolderEntry = {
  path: string
  fileName: string
  saveName: string
  alreadyOnCard: boolean
  parseError: string | null
  /** User data blocks for this save (0 if parse failed). */
  blockCount: number
  /** File mtime for newest-first ordering. */
  mtimeMs: number
}

export type GciFolderScanCardStats = {
  directoryFileCount: number
  freeBlocks: number
}

export async function scanGciFolderAgainstRaw(
  rawPath: string,
  gciFolder: string,
): Promise<
  { ok: true; entries: GciFolderEntry[]; cardStats: GciFolderScanCardStats } | { ok: false; error: string }
> {
  let rawBuf: Buffer
  try {
    rawBuf = await fs.readFile(rawPath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }

  const cardLoad = MemcardImage.load(rawBuf)
  if (!cardLoad.ok) {
    return { ok: false, error: cardLoad.error }
  }
  const card = cardLoad.card

  let dirents
  try {
    dirents = await fs.readdir(gciFolder, { withFileTypes: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }

  const gciFiles = dirents
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.gci'))
    .map((e) => path.join(gciFolder, e.name))

  const entries: GciFolderEntry[] = []
  for (const filePath of gciFiles) {
    const fileName = path.basename(filePath)
    let mtimeMs = 0
    try {
      const st = await fs.stat(filePath)
      mtimeMs = st.mtimeMs
    } catch {
      /* mtime stays 0 */
    }

    let buf: Buffer
    try {
      buf = await fs.readFile(filePath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      entries.push({
        path: filePath,
        fileName,
        saveName: '',
        alreadyOnCard: false,
        parseError: msg,
        blockCount: 0,
        mtimeMs,
      })
      continue
    }

    const parsed = parseGciFile(buf)
    if (!parsed.ok) {
      entries.push({
        path: filePath,
        fileName,
        saveName: '',
        alreadyOnCard: false,
        parseError: parsed.error,
        blockCount: 0,
        mtimeMs,
      })
      continue
    }

    const dentry = parsed.value.dentry
    const saveName = filenameString(dentry)
    const alreadyOnCard = card.isTitlePresent(dentry)
    const blockCount = dentry.readUInt16BE(0x38)
    entries.push({
      path: filePath,
      fileName,
      saveName,
      alreadyOnCard,
      parseError: null,
      blockCount,
      mtimeMs,
    })
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs)

  const cardStats: GciFolderScanCardStats = {
    directoryFileCount: card.getDirectoryEntryCount(),
    freeBlocks: card.getFreeBlockCount(),
  }

  return { ok: true, entries, cardStats }
}
