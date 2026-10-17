import fs from 'node:fs/promises'
import path from 'node:path'
import { filenameString } from './dentry'
import { parseGciFile } from './gci'
import { MemcardImage } from './memcardImage'
import { decodeTmceExportHeader } from './tmceExportHeader'

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
  /** TM:CE recording metadata (characters as Melee CKIND ids), when decodable. */
  tmce?: { hmn: number; hmnCostume: number; cpu: number; cpuCostume: number; name: string } | null
}

export type GciFolderScanCardStats = {
  directoryFileCount: number
  freeBlocks: number
}

export async function scanGciFolderAgainstRaw(
  rawPath: string,
  gciFolder: string,
): Promise<
  | {
      ok: true
      entries: GciFolderEntry[]
      /** null when the target card couldn't be opened (see cardError). */
      cardStats: GciFolderScanCardStats | null
      /** Why the target .raw couldn't be opened; the saves are still listed. */
      cardError?: string
    }
  | { ok: false; error: string }
> {
  // The saves folder is the thing being listed: only its failure fails the scan.
  let dirents
  try {
    dirents = await fs.readdir(gciFolder, { withFileTypes: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Can't read the saves folder ${gciFolder}: ${msg}` }
  }

  // A missing/unreadable target card (e.g. SD card unplugged) only disables the on-card comparison.
  let card: MemcardImage | null = null
  let cardError: string | undefined
  try {
    const cardLoad = MemcardImage.load(await fs.readFile(rawPath))
    if (cardLoad.ok) card = cardLoad.card
    else cardError = `Target card ${rawPath} isn't a valid memory card: ${cardLoad.error}`
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code
    cardError =
      code === 'ENOENT'
        ? `Target card ${rawPath} doesn't exist right now (SD card unplugged?)`
        : `Can't open target card ${rawPath}: ${e instanceof Error ? e.message : String(e)}`
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
    const alreadyOnCard = card ? card.isTitlePresent(dentry) : false
    const blockCount = dentry.readUInt16BE(0x38)
    const h = decodeTmceExportHeader(buf)
    entries.push({
      path: filePath,
      fileName,
      saveName,
      alreadyOnCard,
      parseError: null,
      blockCount,
      mtimeMs,
      tmce: h
        ? { hmn: h.hmn, hmnCostume: h.hmnCostume, cpu: h.cpu, cpuCostume: h.cpuCostume, name: h.name }
        : null,
    })
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs)

  const cardStats: GciFolderScanCardStats | null = card
    ? { directoryFileCount: card.getDirectoryEntryCount(), freeBlocks: card.getFreeBlockCount() }
    : null

  return { ok: true, entries, cardStats, cardError }
}
