import fs from 'node:fs/promises'
import path from 'node:path'
import { touchFileAccessAndModified, writeFileReplacingBirthtime } from '../fileTimes'
import type { MemcardResultCode } from './constants'
import { gcTimestampSecondsFromUnixMs } from './gcTime'
import { parseGciFile } from './gci'
import { MemcardImage } from './memcardImage'
import { prepareDentryForImport } from './gciWriteMiddleware'
import type { GciFilenameSanitizeStyle } from './gciWriteMiddleware'

export { MemcardImage } from './memcardImage'
export type { GciFolderEntry, GciFolderScanCardStats } from './scan'
export { scanGciFolderAgainstRaw } from './scan'
export { formatEmptyCard, createEmptyMemcard } from './format'
export { parseGciFile } from './gci'
export type { ParsedGci } from './gci'
export type { MemcardResultCode } from './constants'
export { DENTRY_STRLEN, GCI_FILENAME_TMCE_MAX_BYTES } from './constants'
export { GC_CARD_TIME_EPOCH_UNIX_SECONDS, gcTimestampSecondsFromUnixMs } from './gcTime'
export type { GciFilenameSanitizeStyle } from './gciWriteMiddleware'
export {
  clampGciFilenameLatin1,
  normalizeGciFilenameAscii,
  normalizeGciFilenameTmceShort,
  prepareDentryForImport,
} from './gciWriteMiddleware'
export type { GciDentryDescription } from './gciCharacterHints'
export { describeGciDentry } from './gciCharacterHints'
export {
  canonicalShortSlugForMeleeId,
  MELEE_CHARACTER_LABEL,
  MELEE_CHARACTER_SHORT_SLUG,
  MeleeExternalCharacterId,
  meleeCharacterIdFromSlug,
} from './meleeCharacterIds'

function resultMessage(code: MemcardResultCode): string {
  switch (code) {
    case 'SUCCESS':
      return 'Import succeeded'
    case 'OPENFAIL':
      return 'Could not open file'
    case 'OUTOFBLOCKS':
      return 'Not enough free blocks on memory card'
    case 'OUTOFDIRENTRIES':
      return 'Directory is full (127 files)'
    case 'LENGTHFAIL':
      return 'GCI payload length does not match block count'
    case 'INVALIDFILESIZE':
      return 'Invalid file size'
    case 'TITLEPRESENT':
      return 'Same save (game code + filename) already exists on card'
    case 'NOTFOUND':
      return 'Save not found on card'
    case 'NOMEMCARD':
      return 'Invalid memory card'
    case 'FAIL':
      return 'Import failed'
    default:
      return 'Import failed'
  }
}

export type ImportIntoRawOptions = {
  /** When GCI dentry m_time is 0, use this GC seconds-since-2000 (otherwise current time). */
  mTimeGcSeconds?: number
  /**
   * Normalize the dentry filename before writing. `none` leaves bytes as in the file.
   * Changing names can break some games if save data references the dentry string.
   */
  gciFilenameSanitize?: GciFilenameSanitizeStyle
}

/**
 * Import GCIs into an in-memory card (mutates `card`).
 */
export async function importGcisIntoMemcard(
  card: MemcardImage,
  gciPaths: string[],
  opts?: ImportIntoRawOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (gciPaths.length === 0) {
    return { ok: true }
  }

  const resolved: ImportIntoRawOptions = {
    mTimeGcSeconds:
      opts?.mTimeGcSeconds !== undefined
        ? opts.mTimeGcSeconds
        : gcTimestampSecondsFromUnixMs(Date.now()),
    gciFilenameSanitize: opts?.gciFilenameSanitize,
  }

  for (const gciPath of gciPaths) {
    let gciBuf: Buffer
    try {
      gciBuf = await fs.readFile(gciPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `${path.basename(gciPath)}: ${msg}` }
    }

    const gci = parseGciFile(gciBuf)
    if (!gci.ok) {
      return { ok: false, error: `${path.basename(gciPath)}: ${gci.error}` }
    }

    const dentry = prepareDentryForImport(gci.value.dentry, resolved)
    const code = card.importSave(dentry, gci.value.blocks, resolved)
    if (code !== 'SUCCESS') {
      return { ok: false, error: `${path.basename(gciPath)}: ${resultMessage(code)}` }
    }
  }

  return { ok: true }
}

/**
 * Import GCIs in order (caller should pass newest-first). Imports until the card runs out of
 * directory slots or blocks; skips duplicate titles; stops when no more saves fit.
 * Use for auto-batch builds so one oversized or duplicate file does not abort the whole card.
 */
export async function importGcisIntoMemcardGreedy(
  card: MemcardImage,
  gciPaths: string[],
  opts?: ImportIntoRawOptions,
): Promise<
  | { ok: true; importedPaths: string[]; warnings: string[] }
  | { ok: false; error: string }
> {
  if (gciPaths.length === 0) {
    return { ok: true, importedPaths: [], warnings: [] }
  }

  const resolved: ImportIntoRawOptions = {
    mTimeGcSeconds:
      opts?.mTimeGcSeconds !== undefined
        ? opts.mTimeGcSeconds
        : gcTimestampSecondsFromUnixMs(Date.now()),
    gciFilenameSanitize: opts?.gciFilenameSanitize,
  }

  const importedPaths: string[] = []
  const warnings: string[] = []

  for (const gciPath of gciPaths) {
    let gciBuf: Buffer
    try {
      gciBuf = await fs.readFile(gciPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `${path.basename(gciPath)}: ${msg}` }
    }

    const gci = parseGciFile(gciBuf)
    if (!gci.ok) {
      return { ok: false, error: `${path.basename(gciPath)}: ${gci.error}` }
    }

    const dentry = prepareDentryForImport(gci.value.dentry, resolved)
    const code = card.importSave(dentry, gci.value.blocks, resolved)
    if (code === 'SUCCESS') {
      importedPaths.push(gciPath)
      continue
    }
    if (code === 'OUTOFBLOCKS' || code === 'OUTOFDIRENTRIES') {
      warnings.push(
        `${path.basename(gciPath)}: ${resultMessage(code)} (card full — remaining files not added)`,
      )
      break
    }
    if (code === 'TITLEPRESENT') {
      warnings.push(`${path.basename(gciPath)}: ${resultMessage(code)} (skipped)`)
      continue
    }
    return { ok: false, error: `${path.basename(gciPath)}: ${resultMessage(code)}` }
  }

  if (importedPaths.length === 0) {
    const hint =
      warnings.length > 0
        ? warnings.join(' ')
        : 'No saves could be imported onto an empty card'
    return { ok: false, error: hint }
  }

  return { ok: true, importedPaths, warnings }
}

/**
 * Apply folder selection: remove on-card saves (unchecked), then add new saves (checked).
 * Identity for removal comes from each `.gci` file's dentry (same as on-card match).
 */
export async function syncFolderSelectionToRaw(
  rawPath: string,
  args: { gciPathsToAdd: string[]; gciPathsToRemove: string[] },
  opts?: ImportIntoRawOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { gciPathsToAdd, gciPathsToRemove } = args
  if (gciPathsToAdd.length === 0 && gciPathsToRemove.length === 0) {
    return { ok: false, error: 'Nothing to apply' }
  }

  let rawBuf: Buffer
  try {
    rawBuf = await fs.readFile(rawPath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `OPENFAIL: ${msg}` }
  }

  const cardLoad = MemcardImage.load(rawBuf)
  if (!cardLoad.ok) {
    return { ok: false, error: cardLoad.error }
  }
  const card = cardLoad.card

  for (const gciPath of gciPathsToRemove) {
    let gciBuf: Buffer
    try {
      gciBuf = await fs.readFile(gciPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `${path.basename(gciPath)}: ${msg}` }
    }
    const gci = parseGciFile(gciBuf)
    if (!gci.ok) {
      return { ok: false, error: `${path.basename(gciPath)}: ${gci.error}` }
    }
    const code = card.removeSaveByIdentity(gci.value.dentry)
    if (code !== 'SUCCESS') {
      return { ok: false, error: `${path.basename(gciPath)}: ${resultMessage(code)}` }
    }
  }

  const inner = await importGcisIntoMemcard(card, gciPathsToAdd, opts)
  if (!inner.ok) return inner

  try {
    await writeFileReplacingBirthtime(rawPath, card.toBuffer())
    await touchFileAccessAndModified(rawPath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `WRITEFAIL: ${msg}` }
  }

  return { ok: true }
}

/**
 * Import a `.gci` into an existing `.raw` image. Caller should back up `rawPath` first.
 */
export async function importGciIntoRaw(
  rawPath: string,
  gciPath: string,
  opts?: ImportIntoRawOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let rawBuf: Buffer
  let gciBuf: Buffer
  try {
    rawBuf = await fs.readFile(rawPath)
    gciBuf = await fs.readFile(gciPath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `OPENFAIL: ${msg}` }
  }

  const cardLoad = MemcardImage.load(rawBuf)
  if (!cardLoad.ok) {
    return { ok: false, error: cardLoad.error }
  }
  const card = cardLoad.card

  const gci = parseGciFile(gciBuf)
  if (!gci.ok) {
    return { ok: false, error: gci.error }
  }

  const resolved: ImportIntoRawOptions = {
    mTimeGcSeconds:
      opts?.mTimeGcSeconds !== undefined
        ? opts.mTimeGcSeconds
        : gcTimestampSecondsFromUnixMs(Date.now()),
    gciFilenameSanitize: opts?.gciFilenameSanitize,
  }
  const dentry = prepareDentryForImport(gci.value.dentry, resolved)
  const code = card.importSave(dentry, gci.value.blocks, resolved)
  if (code !== 'SUCCESS') {
    return { ok: false, error: resultMessage(code) }
  }

  try {
    await writeFileReplacingBirthtime(rawPath, card.toBuffer())
    await touchFileAccessAndModified(rawPath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `WRITEFAIL: ${msg}` }
  }

  return { ok: true }
}

/**
 * Import several `.gci` files into one `.raw` in order (single read, sequential `importSave`, one write).
 * Caller should back up `rawPath` first.
 */
export async function importGcisIntoRaw(
  rawPath: string,
  gciPaths: string[],
  opts?: ImportIntoRawOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (gciPaths.length === 0) {
    return { ok: false, error: 'No GCI files to import' }
  }
  return syncFolderSelectionToRaw(rawPath, { gciPathsToAdd: gciPaths, gciPathsToRemove: [] }, opts)
}
