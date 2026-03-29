import { DENTRY_STRLEN, GCI_FILENAME_TMCE_MAX_BYTES } from './constants'
import { filenameString, writeDentryFilename } from './dentry'
import { MELEE_CHARACTER_SHORT_SLUG, meleeCharacterIdFromSlug } from './meleeCharacterIds'

/** How to normalize the dentry’s 32-byte filename before writing to a card. */
export type GciFilenameSanitizeStyle =
  | 'none'
  | 'ascii-title'
  | 'ascii-upper'
  | 'ascii-lower'
  /** Map segments to `MELEE_CHARACTER_SHORT_SLUG`, then clamp for TM:CE (see `GCI_FILENAME_TMCE_MAX_BYTES`). */
  | 'tmce-short'

/** Never exceed hardware dentry length; TM:CE list is stricter — use `maxBytes` from `GCI_FILENAME_TMCE_MAX_BYTES` when needed. */
export function clampGciFilenameLatin1(raw: string, maxBytes: number): string {
  const cap = Math.min(Math.max(1, maxBytes), DENTRY_STRLEN)
  const buf = Buffer.from(raw, 'latin1')
  if (buf.length <= cap) return raw
  return buf.subarray(0, cap).toString('latin1')
}

export function normalizeGciFilenameAscii(
  raw: string,
  style: Exclude<GciFilenameSanitizeStyle, 'none' | 'tmce-short'>,
): string {
  if (style === 'ascii-upper') return raw.toUpperCase()
  if (style === 'ascii-lower') return raw.toLowerCase()
  const segments = raw.split(/[-_\s]+/).filter(Boolean)
  if (segments.length === 0) return raw
  const delim = raw.includes('-') ? '-' : raw.includes('_') ? '_' : ' '
  return segments
    .map((seg) => {
      const lower = seg.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(delim)
}

function sanitizeTailSegmentTmce(seg: string): string {
  return seg.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
}

/**
 * TM:CE-friendly names: roster slugs from `MELEE_CHARACTER_SHORT_SLUG`, short tails, length cap.
 * First segment uses `meleeCharacterIdFromSlug` (e.g. `zelda` → Sheik → `sheik`).
 */
export function normalizeGciFilenameTmceShort(raw: string): string {
  const parts = raw.split(/[-_\s]+/).filter(Boolean)
  if (parts.length === 0) return ''
  const id = meleeCharacterIdFromSlug(parts[0]!.toLowerCase())
  const head =
    id !== null
      ? MELEE_CHARACTER_SHORT_SLUG[id]
      : parts[0]!.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
  const tail = parts
    .slice(1)
    .map(sanitizeTailSegmentTmce)
    .filter((s) => s.length > 0)
  const joined = [head, ...tail].join('-')
  return clampGciFilenameLatin1(joined, GCI_FILENAME_TMCE_MAX_BYTES)
}

function normalizedFilenameForStyle(raw: string, style: GciFilenameSanitizeStyle): string {
  if (style === 'none') return raw
  if (style === 'tmce-short') return normalizeGciFilenameTmceShort(raw)
  return normalizeGciFilenameAscii(raw, style)
}

function maxBytesForStyle(style: GciFilenameSanitizeStyle): number {
  if (style === 'tmce-short') return GCI_FILENAME_TMCE_MAX_BYTES
  return DENTRY_STRLEN
}

/**
 * Clone dentry and optionally rewrite the filename field. Changing the dentry filename can
 * desync some games’ internal save data if the payload references that string — default is `none`.
 */
export function prepareDentryForImport(
  dentry: Buffer,
  opts?: { gciFilenameSanitize?: GciFilenameSanitizeStyle },
): Buffer {
  const style = opts?.gciFilenameSanitize ?? 'none'
  const copy = Buffer.from(dentry)
  const raw = filenameString(copy)
  if (style === 'none') {
    writeDentryFilename(copy, clampGciFilenameLatin1(raw, DENTRY_STRLEN))
    return copy
  }
  let next = normalizedFilenameForStyle(raw, style)
  next = clampGciFilenameLatin1(next, maxBytesForStyle(style))
  writeDentryFilename(copy, next)
  return copy
}
