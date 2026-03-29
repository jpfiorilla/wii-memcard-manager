import { BAT_SIZE, MC_FST_BLOCKS } from './constants'

export function getNextBlockFromBat(batBlock: Buffer, block: number): number {
  if (block < MC_FST_BLOCKS || block > 4091) return 0
  return batBlock.readUInt16BE(0x0a + (block - MC_FST_BLOCKS) * 2)
}

/**
 * Find next free block. `maxBlock` is total block count (exclusive upper index for user blocks is maxBlock).
 * Matches Dolphin `BlockAlloc::NextFreeBlock` scan order, with `maxBlock` as exclusive end (total blocks on card).
 */
export function nextFreeBlock(batBlock: Buffer, maxBlock: number, startingBlock: number): number {
  const freeBlocks = batBlock.readUInt16BE(0x06)
  if (!freeBlocks) return 0xffff

  let max = Math.min(maxBlock, BAT_SIZE + MC_FST_BLOCKS)
  for (let i = startingBlock; i < max; i++) {
    if (batBlock.readUInt16BE(0x0a + (i - MC_FST_BLOCKS) * 2) === 0) {
      return i
    }
  }
  for (let i = MC_FST_BLOCKS; i < startingBlock; i++) {
    if (batBlock.readUInt16BE(0x0a + (i - MC_FST_BLOCKS) * 2) === 0) {
      return i
    }
  }
  return 0xffff
}
