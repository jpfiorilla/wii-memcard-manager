import { describe, expect, it } from 'vitest'
import {
  LATEST,
  LATEST_OF_EACH,
  SHUFFLE,
  matchupPlaylistId,
  playlistName,
  playlistShuffles,
  resolvePlaylistId,
  sanitizeCustomPlaylist,
  selectRecordings,
  summarizePlaylists,
  type CustomPlaylist,
  type Recording,
} from '../electron/main/playlists'

const FALCO = 20
const FOX = 2
const SHEIK = 19
const names: Record<number, string> = { [FALCO]: 'Falco', [FOX]: 'Fox', [SHEIK]: 'Sheik' }
const charName = (n: number) => names[n] ?? null

// rec(i) is newer the higher i is.
const rec = (i: number, opponent: number | null): Recording => ({ path: `/r/${i}.gci`, name: `r${i}`, mtimeMs: i * 1000, opponent })
const recs: Recording[] = [
  ...[1, 2, 3, 4, 5].map((i) => rec(i, FALCO)),
  ...[6, 7, 8, 9].map((i) => rec(i, FOX)),
  ...[10, 11].map((i) => rec(i, SHEIK)),
  rec(12, null),
]
const spacies: CustomPlaylist = { id: 'yours:abc', name: 'Spacies', matchups: [FALCO, FOX], order: 'newest', count: 5 }

describe('selectRecordings', () => {
  it('Latest: newest first, capped', () => {
    expect(selectRecordings(recs, LATEST, [], 3, 1).map((r) => r.name)).toEqual(['r12', 'r11', 'r10'])
  })

  it('Latest of each: 3 newest per matchup', () => {
    const got = selectRecordings(recs, LATEST_OF_EACH, [], 25, 1).map((r) => r.name)
    expect(got).toEqual(['r12', 'r11', 'r10', 'r9', 'r8', 'r7', 'r5', 'r4', 'r3'])
  })

  it('matchup: only that opponent', () => {
    expect(selectRecordings(recs, matchupPlaylistId(FOX), [], 25, 1).map((r) => r.name)).toEqual(['r9', 'r8', 'r7', 'r6'])
  })

  it('Shuffle: same seed same card, new seed new card', () => {
    const a = selectRecordings(recs, SHUFFLE, [], 6, 1).map((r) => r.name)
    expect(selectRecordings(recs, SHUFFLE, [], 6, 1).map((r) => r.name)).toEqual(a)
    expect(selectRecordings(recs, SHUFFLE, [], 6, 2).map((r) => r.name)).not.toEqual(a)
    expect(new Set(a).size).toBe(6)
  })

  it('Yours: matchups, count and the card cap', () => {
    expect(selectRecordings(recs, spacies.id, [spacies], 25, 1).map((r) => r.name)).toEqual(['r9', 'r8', 'r7', 'r6', 'r5'])
    expect(selectRecordings(recs, spacies.id, [spacies], 2, 1)).toHaveLength(2)
  })

  it('a deleted playlist falls back to Latest', () => {
    expect(resolvePlaylistId('yours:gone', [])).toBe(LATEST)
    expect(selectRecordings(recs, 'yours:gone', [], 1, 1).map((r) => r.name)).toEqual(['r12'])
  })
})

describe('playlist names and summaries', () => {
  it('names', () => {
    expect(playlistName(LATEST_OF_EACH, [], charName)).toBe('Latest of each')
    expect(playlistName(matchupPlaylistId(FALCO), [], charName)).toBe('Falco')
    expect(playlistName(spacies.id, [spacies], charName)).toBe('Spacies')
  })

  it('shuffles', () => {
    expect(playlistShuffles(SHUFFLE, [])).toBe(true)
    expect(playlistShuffles(LATEST, [])).toBe(false)
    expect(playlistShuffles(spacies.id, [{ ...spacies, order: 'shuffle' }])).toBe(true)
  })

  it('matchups are listed biggest first, then Yours', () => {
    const s = summarizePlaylists(recs, [spacies], 25, charName)
    expect(s.map((p) => p.id)).toEqual([LATEST, LATEST_OF_EACH, SHUFFLE, matchupPlaylistId(FALCO), matchupPlaylistId(FOX), matchupPlaylistId(SHEIK), spacies.id])
    expect(s.find((p) => p.id === spacies.id)!.available).toBe(9)
  })
})

describe('sanitizeCustomPlaylist', () => {
  it('rejects bad input and clamps', () => {
    expect(sanitizeCustomPlaylist({ id: 'x', name: 'a' })).toBeNull()
    expect(sanitizeCustomPlaylist({ id: 'yours:1', name: '  ' })).toBeNull()
    expect(sanitizeCustomPlaylist({ id: 'yours:1', name: 'A', matchups: [20, 20, 99, 'x'], order: 'zzz', count: 500 })).toEqual({
      id: 'yours:1',
      name: 'A',
      matchups: [20],
      order: 'newest',
      count: 25,
    })
  })
})
