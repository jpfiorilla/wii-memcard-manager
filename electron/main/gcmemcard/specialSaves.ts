import { BLOCK_SIZE } from './constants'

function cardGetSerialNo(hdr: Buffer): { serial1: number; serial2: number } {
  const s: number[] = []
  for (let i = 0; i < 8; i++) {
    s.push(hdr.readUInt32BE(i * 4))
  }
  return {
    serial1: s[0]! ^ s[2]! ^ s[4]! ^ s[6]!,
    serial2: s[1]! ^ s[3]! ^ s[5]! ^ s[7]!,
  }
}

/** Matches Dolphin `FZEROGX_MakeSaveGameValid` for `f_zero.dat`. */
export function fzeroMakeSaveGameValid(hdr: Buffer, filename: string, blocks: Buffer[]): void {
  if (filename !== 'f_zero.dat') return
  if (blocks.length < 4) return

  const { serial1, serial2 } = cardGetSerialNo(hdr)

  blocks[1]!.writeUInt16BE((serial1 >>> 16) & 0xffff, 0x0066)
  blocks[3]!.writeUInt16BE((serial2 >>> 16) & 0xffff, 0x1580)
  blocks[1]!.writeUInt16BE(serial1 & 0xffff, 0x0060)
  blocks[1]!.writeUInt16BE(serial2 & 0xffff, 0x0200)

  let chksum = 0xffff
  for (let i = 0x02; i < 0x8000; i++) {
    const bi = Math.floor(i / BLOCK_SIZE)
    const off = i % BLOCK_SIZE
    chksum ^= blocks[bi]![off]! & 0xff
    for (let j = 8; j > 0; j--) {
      if (chksum & 1) {
        chksum = (chksum >> 1) ^ 0x8408
      } else {
        chksum >>= 1
      }
    }
  }
  blocks[0]!.writeUInt16BE((~chksum) & 0xffff, 0x00)
}

/** Matches Dolphin `PSO_MakeSaveGameValid` for PSO system saves. */
export function psoMakeSaveGameValid(hdr: Buffer, filename: string, blocks: Buffer[]): void {
  let pso3offset = 0
  if (filename === 'PSO_SYSTEM') {
    // PSO 1&2
  } else if (filename === 'PSO3_SYSTEM') {
    pso3offset = 0x10
  } else {
    return
  }
  if (blocks.length < 2) return

  const { serial1, serial2 } = cardGetSerialNo(hdr)
  blocks[1]!.writeUInt32BE(serial1, 0x0158)
  blocks[1]!.writeUInt32BE(serial2, 0x015c)

  const crc32LUT = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let chksum = i
    for (let j = 8; j > 0; j--) {
      if (chksum & 1) {
        chksum = (chksum >> 1) ^ 0xedb88320
      } else {
        chksum >>= 1
      }
    }
    crc32LUT[i] = chksum >>> 0
  }

  let chksum = 0xdebb20e3
  const b1 = blocks[1]!
  for (let i = 0x004c; i < 0x0164 + pso3offset; i++) {
    chksum = (((chksum >> 8) & 0xffffff) ^ crc32LUT[(chksum ^ b1[i]!) & 0xff]) >>> 0
  }
  b1.writeUInt32BE(chksum ^ 0xffffffff, 0x0048)
}
