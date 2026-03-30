import { MAX_CARD_DIRECTORY_FILES } from "@/constants/card";
import type { CardScanStats, GciFolderEntry } from "@/types/memcard";

/** Returns a user-facing error if the current checkbox state cannot be applied to the card. */
export function selectionInvalidReason(
  cardStats: CardScanStats,
  candidates: GciFolderEntry[],
  selectedPaths: Set<string>,
): string | null {
  const pickedAdd = candidates.filter(
    (c) => selectedPaths.has(c.path) && !c.parseError && !c.alreadyOnCard,
  );
  const pickedRemove = candidates.filter(
    (c) => !selectedPaths.has(c.path) && !c.parseError && c.alreadyOnCard,
  );
  if (pickedAdd.length === 0 && pickedRemove.length === 0) return null;
  const finalDirCount =
    cardStats.directoryFileCount - pickedRemove.length + pickedAdd.length;
  if (finalDirCount > MAX_CARD_DIRECTORY_FILES) {
    return `After this change the card would have ${finalDirCount} save slots used (max ${MAX_CARD_DIRECTORY_FILES}).`;
  }
  const blocksFreed = pickedRemove.reduce((s, c) => s + c.blockCount, 0);
  const blocksNeeded = pickedAdd.reduce((s, c) => s + c.blockCount, 0);
  const netFree = cardStats.freeBlocks + blocksFreed - blocksNeeded;
  if (netFree < 0) {
    return `Not enough free blocks: need ${blocksNeeded} for new saves, but only ${cardStats.freeBlocks + blocksFreed} blocks are available after freeing removals.`;
  }
  return null;
}
