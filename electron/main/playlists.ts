/**
 * Playlists decide which TM:CE recordings go on the card: the built-in ones (Latest, Latest of
 * each, Shuffle, one per matchup) and the user's own ("Yours"). Pure: no Electron or file access.
 */

export type PlaylistOrder = 'newest' | 'shuffle'

/** A playlist the user made. */
export type CustomPlaylist = {
  /** `yours:<random>` */
  id: string
  name: string
  /** Opponent character ids (Melee CKIND); empty = any matchup. */
  matchups: number[]
  order: PlaylistOrder
  /** How many recordings; also capped by the card limit. */
  count: number
}

export type Recording = {
  path: string
  /** File name without `.gci`. */
  name: string
  mtimeMs: number
  /** Opponent character id (CKIND), or null when the recording's header can't be read. */
  opponent: number | null
}

export type PlaylistGroup = 'recent' | 'matchup' | 'yours'

export type PlaylistSummary = {
  id: string
  name: string
  group: PlaylistGroup
  /** Short line under the name. */
  description: string
  /** Matchup playlists: the opponent's character id. */
  opponent?: number
  /** Recordings this playlist can draw from. */
  available: number
  /** A new mix every time the Wii syncs. */
  shuffles: boolean
}

export const LATEST = 'latest'
export const LATEST_OF_EACH = 'latest-of-each'
export const SHUFFLE = 'shuffle'
export const LATEST_OF_EACH_PER_MATCHUP = 3
export const DEFAULT_PLAYLIST = LATEST

const MATCHUP_PREFIX = 'matchup:'
export const matchupPlaylistId = (ckind: number) => `${MATCHUP_PREFIX}${ckind}`
export const isCustomPlaylistId = (id: string) => id.startsWith('yours:')

function matchupOf(id: string): number | null {
  if (!id.startsWith(MATCHUP_PREFIX)) return null
  const n = Number(id.slice(MATCHUP_PREFIX.length))
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function newestFirst(recs: Recording[]): Recording[] {
  return [...recs].sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path))
}

/** Deterministic shuffle (mulberry32), so the same seed always gives the same card. */
export function seededShuffle<T>(list: T[], seed: number): T[] {
  let t = seed >>> 0
  const rand = () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function latestOfEach(sorted: Recording[]): Recording[] {
  const seen = new Map<number, number>()
  return sorted.filter((r) => {
    const k = r.opponent ?? -1
    const n = (seen.get(k) ?? 0) + 1
    seen.set(k, n)
    return n <= LATEST_OF_EACH_PER_MATCHUP
  })
}

/** The playlist id that's actually used: unknown or deleted playlists fall back to Latest. */
export function resolvePlaylistId(id: string, custom: CustomPlaylist[]): string {
  if (id === LATEST || id === LATEST_OF_EACH || id === SHUFFLE) return id
  if (matchupOf(id) !== null) return id
  if (custom.some((p) => p.id === id)) return id
  return DEFAULT_PLAYLIST
}

/** The recordings that go on the card for a playlist, newest first unless it shuffles. */
export function selectRecordings(
  recs: Recording[],
  playlistId: string,
  custom: CustomPlaylist[],
  cap: number,
  seed: number,
): Recording[] {
  const limit = Math.max(0, cap)
  const sorted = newestFirst(recs)
  const id = resolvePlaylistId(playlistId, custom)
  if (id === LATEST) return sorted.slice(0, limit)
  if (id === LATEST_OF_EACH) return latestOfEach(sorted).slice(0, limit)
  if (id === SHUFFLE) return seededShuffle(sorted, seed).slice(0, limit)
  const opp = matchupOf(id)
  if (opp !== null) return sorted.filter((r) => r.opponent === opp).slice(0, limit)

  const p = custom.find((c) => c.id === id)!
  const pool = p.matchups.length ? sorted.filter((r) => r.opponent !== null && p.matchups.includes(r.opponent)) : sorted
  const n = Math.min(limit, Math.max(1, p.count))
  return (p.order === 'shuffle' ? seededShuffle(pool, seed) : pool).slice(0, n)
}

export function playlistShuffles(id: string, custom: CustomPlaylist[]): boolean {
  const r = resolvePlaylistId(id, custom)
  if (r === SHUFFLE) return true
  return custom.find((c) => c.id === r)?.order === 'shuffle'
}

export function playlistName(id: string, custom: CustomPlaylist[], characterName: (ckind: number) => string | null): string {
  const r = resolvePlaylistId(id, custom)
  if (r === LATEST) return 'Latest'
  if (r === LATEST_OF_EACH) return 'Latest of each'
  if (r === SHUFFLE) return 'Shuffle'
  const opp = matchupOf(r)
  if (opp !== null) return characterName(opp) ?? `Character ${opp}`
  return custom.find((c) => c.id === r)!.name
}

/** Every playlist the window shows: Recent, one per matchup that has recordings, then Yours. */
export function summarizePlaylists(
  recs: Recording[],
  custom: CustomPlaylist[],
  cap: number,
  characterName: (ckind: number) => string | null,
): PlaylistSummary[] {
  const counts = new Map<number, number>()
  for (const r of recs) if (r.opponent !== null) counts.set(r.opponent, (counts.get(r.opponent) ?? 0) + 1)

  const out: PlaylistSummary[] = [
    { id: LATEST, name: 'Latest', group: 'recent', description: `Newest ${cap}, any matchup`, available: recs.length, shuffles: false },
    {
      id: LATEST_OF_EACH,
      name: 'Latest of each',
      group: 'recent',
      description: `${LATEST_OF_EACH_PER_MATCHUP} newest per matchup`,
      available: latestOfEach(recs).length,
      shuffles: false,
    },
    { id: SHUFFLE, name: 'Shuffle', group: 'recent', description: `Random ${cap}, new mix every sync`, available: recs.length, shuffles: true },
  ]
  const matchups = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  for (const [ckind, n] of matchups) {
    out.push({
      id: matchupPlaylistId(ckind),
      name: characterName(ckind) ?? `Character ${ckind}`,
      group: 'matchup',
      description: `${n} recording${n === 1 ? '' : 's'}`,
      opponent: ckind,
      available: n,
      shuffles: false,
    })
  }
  for (const p of custom) {
    const pool = p.matchups.length ? recs.filter((r) => r.opponent !== null && p.matchups.includes(r.opponent)) : recs
    const who = p.matchups.length ? p.matchups.map((m) => characterName(m) ?? String(m)).join(' + ') : 'Any matchup'
    const how = p.order === 'shuffle' ? `shuffle ${p.count}` : `newest ${p.count}`
    out.push({ id: p.id, name: p.name, group: 'yours', description: `${who} · ${how}`, available: pool.length, shuffles: p.order === 'shuffle' })
  }
  return out
}

/** Validates a playlist coming from settings or the window. */
export function sanitizeCustomPlaylist(raw: unknown): CustomPlaylist | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !isCustomPlaylistId(o.id)) return null
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 40) : ''
  if (!name) return null
  const matchups = Array.isArray(o.matchups)
    ? [...new Set(o.matchups.filter((m): m is number => Number.isInteger(m) && (m as number) >= 0 && (m as number) <= 25))]
    : []
  const order: PlaylistOrder = o.order === 'shuffle' ? 'shuffle' : 'newest'
  const count = Number.isInteger(o.count) && (o.count as number) >= 1 && (o.count as number) <= 60 ? (o.count as number) : 25
  return { id: o.id, name, matchups, order, count }
}
