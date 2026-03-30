import { MAX_CARD_DIRECTORY_FILES } from "../constants/card";
import type { CardScanStats, GciFolderEntry } from "../types/memcard";

function parseOk(c: GciFolderEntry): boolean {
  return !c.parseError;
}

/**
 * Selection for "Select all importable":
 *
 * 1. Every parseable on-card row is selected.
 * 2. Not-on-card files are considered in **mtime descending** order. We greedily select a
 *    **prefix** of newest-first files that fit **without** removing any on-card saves (directory
 *    slots and free blocks).
 * 3. If any not-on-card files remain unselected (typically because the directory is full), we
 *    attempt to add **at most one** more by evicting **oldest** selected on-card saves until that
 *    single import fits — same accounting as `selectionInvalidReason`. We try candidates in
 *    newest-first order so an infeasible file (e.g. too large) is skipped and the next can win.
 *
 * Step 3 avoids replacing the entire card when the folder contains many not-on-card `.gci` files:
 * only one "swap" is proposed per click, matching the common case of adding the newest replay.
 */
export function selectionSetForSelectAllImportable(
  candidates: GciFolderEntry[],
  cardStats: CardScanStats,
): Set<string> {
  const { directoryFileCount: dirCount, freeBlocks } = cardStats;

  const sel = new Set<string>();
  for (const c of candidates) {
    if (!parseOk(c)) continue;
    if (c.alreadyOnCard) sel.add(c.path);
  }

  const toAdd = candidates
    .filter((c) => parseOk(c) && !c.alreadyOnCard)
    .sort(
      (a, b) =>
        b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path, "en"),
    );

  let addedWithoutEviction = 0;
  let blocksFromAdds = 0;
  for (const c of toAdd) {
    if (dirCount + addedWithoutEviction + 1 > MAX_CARD_DIRECTORY_FILES) break;
    if (freeBlocks - blocksFromAdds - c.blockCount < 0) break;
    sel.add(c.path);
    addedWithoutEviction++;
    blocksFromAdds += c.blockCount;
  }

  for (const c of toAdd) {
    if (sel.has(c.path)) continue;
    const r = tryAddOneNotOnCardWithEviction(candidates, cardStats, sel, c);
    if (r === "success") break;
    if (r === "abort") break;
  }

  return sel;
}

type TryAddResult = "success" | "retry" | "abort";

function tryAddOneNotOnCardWithEviction(
  candidates: GciFolderEntry[],
  cardStats: CardScanStats,
  sel: Set<string>,
  c: GciFolderEntry,
): TryAddResult {
  const { directoryFileCount: dirCount, freeBlocks } = cardStats;
  sel.add(c.path);
  while (true) {
    const remove = candidates.filter(
      (x) => parseOk(x) && x.alreadyOnCard && !sel.has(x.path),
    );
    const add = candidates.filter(
      (x) => parseOk(x) && !x.alreadyOnCard && sel.has(x.path),
    );
    const finalDir = dirCount - remove.length + add.length;
    const blocksFreed = remove.reduce((s, x) => s + x.blockCount, 0);
    const blocksNeeded = add.reduce((s, x) => s + x.blockCount, 0);
    const netFree = freeBlocks + blocksFreed - blocksNeeded;
    if (finalDir <= MAX_CARD_DIRECTORY_FILES && netFree >= 0) {
      return "success";
    }
    const onCardSelected = candidates.filter(
      (x) => parseOk(x) && x.alreadyOnCard && sel.has(x.path),
    );
    if (onCardSelected.length === 0) {
      sel.delete(c.path);
      if (finalDir > MAX_CARD_DIRECTORY_FILES) {
        return "abort";
      }
      return "retry";
    }
    onCardSelected.sort(
      (a, b) => a.mtimeMs - b.mtimeMs || a.path.localeCompare(b.path, "en"),
    );
    sel.delete(onCardSelected[0]!.path);
  }
}
