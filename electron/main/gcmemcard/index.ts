import fs from 'node:fs/promises'
import type { MemcardResultCode } from './constants'
import { parseGciFile } from './gci'
import { MemcardImage } from './memcardImage'

export { MemcardImage } from './memcardImage'
export { formatEmptyCard, createEmptyMemcard } from './format'
export { parseGciFile } from './gci'
export type { ParsedGci } from './gci'
export type { MemcardResultCode } from './constants'

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
    case 'NOMEMCARD':
      return 'Invalid memory card'
    case 'FAIL':
      return 'Import failed'
    default:
      return 'Import failed'
  }
}

/**
 * Import a `.gci` into an existing `.raw` image. Caller should back up `rawPath` first.
 */
export async function importGciIntoRaw(
  rawPath: string,
  gciPath: string,
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

  const code = card.importSave(gci.value.dentry, gci.value.blocks)
  if (code !== 'SUCCESS') {
    return { ok: false, error: resultMessage(code) }
  }

  try {
    await fs.writeFile(rawPath, card.toBuffer())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `WRITEFAIL: ${msg}` }
  }

  return { ok: true }
}
