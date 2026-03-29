import { dentryGameCodeString, filenameString } from './dentry'
import { meleeCharacterIdFromSlug, type MeleeExternalCharacterId } from './meleeCharacterIds'

export type GciDentryDescription = {
  gameCode: string
  companyCode: string
  filenameInDentry: string
  /**
   * The GCI header only exposes a 4-char game code + 32-byte filename. Character, opponent,
   * and replay bodies live in game-specific save blocks; we do not parse those here.
   */
  note: string
  /** Heuristic: first `slug-` segment in filenames like `dk-low-upB` (GTME / TM:CE replay exports). */
  meleeCharacterFromFilename?: MeleeExternalCharacterId
}

function firstFilenameSlug(filename: string): string | null {
  const m = /^([A-Za-z0-9]+)[\-_]/i.exec(filename)
  if (!m) return null
  return m[1]
}

/**
 * Describe what we can infer from the standard memory-card dentry alone.
 * For TM:CE (GTME), try to infer a character from `slug-...` style replay filenames.
 */
export function describeGciDentry(dentry: Buffer): GciDentryDescription {
  const gameCode = dentryGameCodeString(dentry)
  const fn = filenameString(dentry)
  const companyCode = dentry.toString('latin1', 4, 8).replace(/\0/g, '')

  let meleeCharacterFromFilename: MeleeExternalCharacterId | undefined
  if (gameCode === 'GTME') {
    const slug = firstFilenameSlug(fn)
    if (slug) {
      const id = meleeCharacterIdFromSlug(slug)
      if (id !== null) meleeCharacterFromFilename = id
    }
  }

  return {
    gameCode,
    companyCode,
    filenameInDentry: fn,
    note:
      'The GCI header only includes game code and a 32-byte filename. Character, opponent, and replay metadata are in game-specific save blocks (not decoded here).',
    meleeCharacterFromFilename,
  }
}
