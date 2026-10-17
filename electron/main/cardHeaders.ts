/**
 * Memory card header reuse.
 *
 * A GameCube card's header (block 0, first 0x200 bytes) carries a serial derived from the console's
 * SRAM flash ID and the format time. The game's CARD library checks it when it mounts the card; a
 * card formatted elsewhere (our builder used a placeholder serial) can mount as unusable, so TM:CE
 * showed Memory Card A as empty. So we remember the header of the card the Wii actually uses
 * (captured from the SD card whenever it's plugged into the Mac, including its backups/) and stamp
 * it onto every card we build. Directory/BAT/data blocks are untouched, so this is safe.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

const HEADER_BYTES = 0x200
const SIZE_OFF = 0x22

function headerDir(): string {
  return path.join(app.getPath('userData'), 'card-headers')
}

function headerChecksumOk(h: Buffer): boolean {
  let a = 0
  let b = 0
  for (let i = 0; i < 0x1fc; i += 2) {
    const v = h.readUInt16BE(i)
    a = (a + v) & 0xffff
    b = (b + (v ^ 0xffff)) & 0xffff
  }
  if (a === 0xffff) a = 0
  if (b === 0xffff) b = 0
  return h.readUInt16BE(0x1fc) === a && h.readUInt16BE(0x1fe) === b
}

/** Our old builder's placeholder serial (0xab, 0xac, ...). */
function isPlaceholderSerial(h: Buffer): boolean {
  for (let i = 0; i < 12; i++) if (h[i] !== ((0xab + i) & 0xff)) return false
  return true
}

/** A header worth copying: valid checksum, real (console-made) serial. */
export function isRealCardHeader(raw: Buffer): boolean {
  if (raw.length < HEADER_BYTES) return false
  const h = raw.subarray(0, HEADER_BYTES)
  if (h.every((x) => x === 0xff) || h.every((x) => x === 0)) return false
  return headerChecksumOk(h) && !isPlaceholderSerial(h)
}

export async function loadCardHeader(game: string): Promise<Buffer | null> {
  try {
    const b = await fs.readFile(path.join(headerDir(), `${game}.bin`))
    return b.length === HEADER_BYTES ? b : null
  } catch {
    return null
  }
}

/** Save `raw`'s header as the template for `game` if we don't have one yet. True if newly saved. */
export async function rememberCardHeader(
  game: string,
  raw: Buffer,
  source: string,
  expectedSizeMb?: number,
): Promise<boolean> {
  if (!isRealCardHeader(raw)) return false
  if (expectedSizeMb !== undefined && raw.readUInt16BE(SIZE_OFF) !== expectedSizeMb) return false
  if (await loadCardHeader(game)) return false
  await fs.mkdir(headerDir(), { recursive: true })
  await fs.writeFile(path.join(headerDir(), `${game}.bin`), raw.subarray(0, HEADER_BYTES))
  console.log(`[card-header] saved ${game} header from ${source} (serial ${raw.subarray(0, 12).toString('hex')})`)
  return true
}

/** Stamp the remembered header onto a card buffer of the same size. Returns true if it changed. */
export function applyCardHeader(raw: Buffer, header: Buffer | null): boolean {
  if (!header || raw.length < HEADER_BYTES) return false
  if (raw.readUInt16BE(SIZE_OFF) !== header.readUInt16BE(SIZE_OFF)) return false
  if (raw.subarray(0, HEADER_BYTES).equals(header)) return false
  header.copy(raw, 0, 0, HEADER_BYTES)
  return true
}

/** Patch an already-built card file in place (e.g. the staged card) with the remembered header. */
export async function patchCardFile(game: string, file: string): Promise<boolean> {
  const header = await loadCardHeader(game)
  if (!header) return false
  let raw: Buffer
  try {
    raw = await fs.readFile(file)
  } catch {
    return false
  }
  if (!applyCardHeader(raw, header)) return false
  await fs.writeFile(file, raw)
  console.log(`[card-header] stamped ${game} header onto ${file}`)
  return true
}

/**
 * Look at a mounted SD card's saves dir for a real <game>.raw header: the current card first, then
 * the newest backup with a real header. Used whenever a Wii SD card is plugged in.
 */
export async function captureHeadersFromSavesDir(
  savesDir: string,
  games: Iterable<string>,
  expectedSizeMb: number,
): Promise<string[]> {
  const captured: string[] = []
  for (const game of games) {
    if (await loadCardHeader(game)) continue
    const candidates: string[] = [path.join(savesDir, `${game}.raw`)]
    try {
      const backups = (await fs.readdir(path.join(savesDir, 'backups')))
        .filter((n) => n.startsWith(game) && n.endsWith('.raw') && !n.startsWith('._'))
        .sort()
        .reverse()
      candidates.push(...backups.map((n) => path.join(savesDir, 'backups', n)))
    } catch {
      /* no backups dir */
    }
    for (const file of candidates) {
      try {
        const fh = await fs.open(file, 'r')
        const buf = Buffer.alloc(HEADER_BYTES)
        await fh.read(buf, 0, HEADER_BYTES, 0)
        await fh.close()
        if (await rememberCardHeader(game, buf, file, expectedSizeMb)) {
          captured.push(game)
          break
        }
      } catch {
        /* missing / unreadable */
      }
    }
  }
  return captured
}
