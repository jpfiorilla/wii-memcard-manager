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

/** A header worth copying: valid checksum and a console-made serial (not ours, not all zeros). */
export function isRealCardHeader(raw: Buffer): boolean {
  if (raw.length < HEADER_BYTES) return false
  const h = raw.subarray(0, HEADER_BYTES)
  if (h.subarray(0, 12).every((x) => x === 0) || h.subarray(0, 12).every((x) => x === 0xff)) return false
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

/**
 * Save `raw`'s header as the template for `game`. Replaces an existing template only when
 * `replace` is set (the caller found a newer real card). True if the stored header changed.
 */
export async function rememberCardHeader(
  game: string,
  raw: Buffer,
  source: string,
  expectedSizeMb?: number,
  replace = false,
): Promise<boolean> {
  if (!isRealCardHeader(raw)) return false
  if (expectedSizeMb !== undefined && raw.readUInt16BE(SIZE_OFF) !== expectedSizeMb) return false
  const existing = await loadCardHeader(game)
  const next = raw.subarray(0, HEADER_BYTES)
  if (existing && (!replace || existing.equals(next))) return false
  await fs.mkdir(headerDir(), { recursive: true })
  await fs.writeFile(path.join(headerDir(), `${game}.bin`), next)
  console.log(
    `[card-header] ${existing ? 'replaced' : 'saved'} ${game} header from ${source} (serial ${next.subarray(0, 12).toString('hex')})`,
  )
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
 * Look at a mounted SD card's saves dir (the current <game>.raw and backups/) and remember the
 * header of the most recently written card that has a real, console-made serial. Returns the games
 * whose stored header changed.
 */
export async function captureHeadersFromSavesDir(
  savesDir: string,
  games: Iterable<string>,
  expectedSizeMb: number,
): Promise<string[]> {
  const changed: string[] = []
  for (const game of games) {
    const files: string[] = [path.join(savesDir, `${game}.raw`)]
    try {
      for (const n of await fs.readdir(path.join(savesDir, 'backups'))) {
        if (n.startsWith(game) && n.endsWith('.raw') && !n.startsWith('._')) files.push(path.join(savesDir, 'backups', n))
      }
    } catch {
      /* no backups dir */
    }
    const withTimes: { file: string; mtimeMs: number }[] = []
    for (const file of files) {
      try {
        withTimes.push({ file, mtimeMs: (await fs.stat(file)).mtimeMs })
      } catch {
        /* missing */
      }
    }
    withTimes.sort((a, b) => b.mtimeMs - a.mtimeMs)
    for (const { file } of withTimes) {
      try {
        const fh = await fs.open(file, 'r')
        const buf = Buffer.alloc(HEADER_BYTES)
        await fh.read(buf, 0, HEADER_BYTES, 0)
        await fh.close()
        if (!isRealCardHeader(buf) || buf.readUInt16BE(SIZE_OFF) !== expectedSizeMb) continue
        // Newest real card wins; stop at the first one either way.
        if (await rememberCardHeader(game, buf, file, expectedSizeMb, true)) changed.push(game)
        break
      } catch {
        /* unreadable */
      }
    }
  }
  return changed
}
