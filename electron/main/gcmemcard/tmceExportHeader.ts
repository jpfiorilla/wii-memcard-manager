/**
 * Decode the TM:CE (GTME) recording export header from a .gci file.
 *
 * TM:CE writes recordings as Melee-obfuscated save blocks. The first save block starts at
 * GCI offset 0x1EB0 and is 400 bytes: a 16-byte checksum, 16 bytes of block metadata, then
 * the start of the replay buffer, which begins with TM:CE's `ExportHeader`
 * (src/lab_common.h): version, screenshot dims, hmn/cpu character + costume, stage, date,
 * and the 32-byte name shown in TM:CE's load menu.
 *
 * Obfuscation + checksum ported from AlexanderHarrison/tm_replay (MIT), which mirrors
 * Melee's MemoryCard_Deobfuscate (0x803B302C in GTME01.map).
 */

const FIRST_BLOCK_OFFSET = 0x1eb0
const FIRST_BLOCK_SIZE = 400
const HEADER_OFFSET_IN_BLOCK = 32

const ENCODE_LUT = [0x26, 0xff, 0xe8, 0xef, 0x42, 0xd6, 0x01, 0x54, 0x14, 0xa3, 0x80, 0xfd, 0x6e]

// [mask, shift] per bit for each of the 7 permutations (positive = left shift, negative = right).
const PERMUTATIONS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0x01, 0], [0x02, 1], [0x04, 2], [0x08, 3], [0x10, -3], [0x20, -2], [0x40, -1], [0x80, 0]],
  [[0x01, 1], [0x02, 6], [0x04, 0], [0x08, -3], [0x10, 1], [0x20, -1], [0x40, -3], [0x80, -1]],
  [[0x01, 2], [0x02, 2], [0x04, 4], [0x08, 1], [0x10, 3], [0x20, -4], [0x40, -6], [0x80, -2]],
  [[0x01, 4], [0x02, -1], [0x04, 3], [0x08, -2], [0x10, -1], [0x20, 1], [0x40, 1], [0x80, -5]],
  [[0x01, 3], [0x02, 4], [0x04, -1], [0x08, 4], [0x10, 2], [0x20, -3], [0x40, -2], [0x80, -7]],
  [[0x01, 5], [0x02, 5], [0x04, 5], [0x08, 0], [0x10, -2], [0x20, -5], [0x40, -5], [0x80, -3]],
  [[0x01, 6], [0x02, 0], [0x04, -2], [0x08, 2], [0x10, 0], [0x20, 2], [0x40, -4], [0x80, -4]],
]

function deobfuscateByte(prev: number, cur: number): number {
  let out = 0
  for (const [mask, shift] of PERMUTATIONS[prev % 7]) {
    out |= shift >= 0 ? (cur & mask) << shift : (cur & mask) >> -shift
  }
  return ((out & 0xff) ^ ENCODE_LUT[prev % 13] ^ prev) & 0xff
}

/** Decode one save block in place; returns true if Melee's checksum matches. */
export function decodeMeleeSaveBlock(block: Uint8Array): boolean {
  let prev = block[15]
  for (let i = 16; i < block.length; i++) {
    const raw = block[i]
    block[i] = deobfuscateByte(prev, raw)
    prev = raw
  }
  const sum = [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10]
  for (let i = 16; i < block.length; i++) sum[(i - 16) % 16] = (sum[(i - 16) % 16] + block[i]) & 0xff
  for (let i = 1; i < 16; i++) if (sum[i - 1] === sum[i]) sum[i] ^= 0xff
  for (let i = 0; i < 16; i++) if (block[i] !== sum[i]) return false
  return true
}

/** Melee external character IDs (CKIND_* in MexTK fighter.h). */
export const CKIND_NAMES = [
  'Captain Falcon', 'DK', 'Fox', 'Game & Watch', 'Kirby', 'Bowser', 'Link', 'Luigi', 'Mario',
  'Marth', 'Mewtwo', 'Ness', 'Peach', 'Pikachu', 'Ice Climbers', 'Jigglypuff', 'Samus', 'Yoshi',
  'Zelda', 'Sheik', 'Falco', 'Young Link', 'Dr. Mario', 'Roy', 'Pichu', 'Ganondorf',
] as const

export const CKIND_MARTH = 9

export function ckindName(id: number): string | null {
  return CKIND_NAMES[id] ?? null
}

export type TmceExportHeader = {
  version: number
  hmn: number
  hmnCostume: number
  cpu: number
  cpuCostume: number
  stageExternal: number
  stageInternal: number
  /** Local time the recording was exported on the console. */
  date: { year: number; month: number; day: number; hour: number; minute: number; second: number }
  /** Name shown in TM:CE's load menu. */
  name: string
}

/** Returns null for non-TM:CE files, truncated files, or a failed checksum. */
export function decodeTmceExportHeader(gci: Uint8Array): TmceExportHeader | null {
  if (gci.length < FIRST_BLOCK_OFFSET + FIRST_BLOCK_SIZE) return null
  const gameCode = String.fromCharCode(gci[0], gci[1], gci[2], gci[3])
  if (gameCode !== 'GTME') return null

  const block = Uint8Array.from(gci.subarray(FIRST_BLOCK_OFFSET, FIRST_BLOCK_OFFSET + FIRST_BLOCK_SIZE))
  if (!decodeMeleeSaveBlock(block)) return null

  const h = block.subarray(HEADER_OFFSET_IN_BLOCK)
  const u16 = (o: number) => (h[o] << 8) | h[o + 1]
  const version = u16(0)
  const hmn = h[8]
  const cpu = h[10]
  if (version === 0 || hmn >= CKIND_NAMES.length || cpu >= CKIND_NAMES.length) return null

  let end = 23
  while (end < 55 && h[end] !== 0) end++
  const name = Buffer.from(h.subarray(23, end)).toString('latin1')

  return {
    version,
    hmn,
    hmnCostume: h[9],
    cpu,
    cpuCostume: h[11],
    stageExternal: u16(12),
    stageInternal: u16(14),
    date: { month: h[16], day: h[17], year: u16(18), hour: h[20], minute: h[21], second: h[22] },
    name,
  }
}

/**
 * The character the player is practicing against: the CPU when the human is `mainCharacter`,
 * the human when the CPU is `mainCharacter` (recording taken from the other side), else the CPU.
 */
export function opponentOf(h: TmceExportHeader, mainCharacter: number): number {
  if (h.hmn === mainCharacter && h.cpu !== mainCharacter) return h.cpu
  if (h.cpu === mainCharacter && h.hmn !== mainCharacter) return h.hmn
  return h.cpu
}
