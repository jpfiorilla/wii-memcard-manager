import {
  BLOCK_SIZE,
  MC_FST_BLOCKS,
  MBIT_TO_BLOCKS,
  MemCard2043Mb,
} from './constants'
import { setHeaderChecksum, setDirectoryChecksum, setBatChecksum } from './checksum'
import { MemcardImage } from './memcardImage'

/** Create a new empty formatted card image (matches Dolphin `GCMemcard::Format` layout). */
export function formatEmptyCard(sizeMb: number = MemCard2043Mb): Buffer {
  const maxBlock = sizeMb * MBIT_TO_BLOCKS
  const totalSize = maxBlock * BLOCK_SIZE
  const card = Buffer.alloc(totalSize, 0xff)
  card.fill(0, BLOCK_SIZE * 3, BLOCK_SIZE * 5)

  const hdr = card.subarray(0, BLOCK_SIZE)
  hdr.fill(0xff)
  hdr.writeUInt16BE(sizeMb, 0x22)
  hdr.writeUInt16BE(0, 0x24)
  for (let i = 0; i < 12; i++) {
    hdr[i] = (0xab + i) & 0xff
  }
  hdr.writeBigUInt64BE(BigInt(Date.now()), 0x0c)
  hdr.writeUInt32BE(0, 0x14)
  hdr.writeUInt32BE(1, 0x18)
  hdr.writeUInt32BE(0, 0x1c)
  hdr.writeUInt16BE(0, 0x20)
  setHeaderChecksum(hdr)

  const dirBlock = (d: Buffer) => {
    d.fill(0xff)
    d.writeUInt16BE(0, 0x1ffa)
    setDirectoryChecksum(d)
  }
  dirBlock(card.subarray(BLOCK_SIZE, BLOCK_SIZE * 2))
  dirBlock(card.subarray(BLOCK_SIZE * 2, BLOCK_SIZE * 3))

  const batBlock = (b: Buffer) => {
    b.fill(0)
    const free = maxBlock - MC_FST_BLOCKS
    b.writeUInt16BE(free, 0x06)
    b.writeUInt16BE(4, 0x08)
    setBatChecksum(b)
  }
  batBlock(card.subarray(BLOCK_SIZE * 3, BLOCK_SIZE * 4))
  batBlock(card.subarray(BLOCK_SIZE * 4, BLOCK_SIZE * 5))

  const dataCount = maxBlock - MC_FST_BLOCKS
  for (let i = 0; i < dataCount; i++) {
    card.fill(0xff, MC_FST_BLOCKS * BLOCK_SIZE + i * BLOCK_SIZE, MC_FST_BLOCKS * BLOCK_SIZE + (i + 1) * BLOCK_SIZE)
  }

  return card
}

export function createEmptyMemcard(sizeMb: number = MemCard2043Mb): MemcardImage {
  const raw = formatEmptyCard(sizeMb)
  const loaded = MemcardImage.load(raw)
  if (!loaded.ok) {
    throw new Error(loaded.error)
  }
  return loaded.card
}
