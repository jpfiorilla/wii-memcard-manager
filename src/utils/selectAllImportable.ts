import { MAX_CARD_DIRECTORY_FILES } from "../constants/card";
import type {
  CardScanStats,
  GciFolderEntry,
  GciPathOverride,
} from "../types/memcard";

function parseOk(c: GciFolderEntry): boolean {
  return !c.parseError;
}

function getOverride(
  path: string,
  overrides: Readonly<Record<string, GciPathOverride>>,
): GciPathOverride {
  return overrides[path] ?? "neutral";
}

/**
 * Effective selection: on-card minus exclude overrides, forced includes, then greedy
 * "importable" fill on **neutral** not-on-card files only, then at most one extra
 * neutral via eviction (same as legacy `selectionSetForSelectAllImportable` without overrides).
 */
export function deriveSelectionFromOverrides(
  candidates: GciFolderEntry[],
  cardStats: CardScanStats,
  overrides: Readonly<Record<string, GciPathOverride>> = {},
): Set<string> {
  const { directoryFileCount: dirCount, freeBlocks } = cardStats;

  const sel = new Set<string>();
  for (const c of candidates) {
    if (!parseOk(c)) continue;
    if (c.alreadyOnCard) {
      if (getOverride(c.path, overrides) !== "exclude") sel.add(c.path);
    }
  }

  const forcedIncludes = candidates
    .filter(
      (c) =>
        parseOk(c) &&
        !c.alreadyOnCard &&
        getOverride(c.path, overrides) === "include",
    )
    .sort(
      (a, b) =>
        b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path, "en"),
    );
  for (const c of forcedIncludes) {
    tryAddOneNotOnCardWithEviction(candidates, cardStats, sel, c);
  }

  const neutralNotOnCard = candidates
    .filter(
      (c) =>
        parseOk(c) &&
        !c.alreadyOnCard &&
        getOverride(c.path, overrides) === "neutral",
    )
    .sort(
      (a, b) =>
        b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path, "en"),
    );

  let addedWithoutEviction = 0;
  let blocksFromAdds = 0;
  for (const c of neutralNotOnCard) {
    if (dirCount + addedWithoutEviction + 1 > MAX_CARD_DIRECTORY_FILES) break;
    if (freeBlocks - blocksFromAdds - c.blockCount < 0) break;
    sel.add(c.path);
    addedWithoutEviction++;
    blocksFromAdds += c.blockCount;
  }

  for (const c of neutralNotOnCard) {
    if (sel.has(c.path)) continue;
    const r = tryAddOneNotOnCardWithEviction(candidates, cardStats, sel, c);
    if (r === "success") break;
    if (r === "abort") break;
  }

  return sel;
}

/**
 * `overrides` empty → same behavior as before per-path overrides existed.
 */
export function selectionSetForSelectAllImportable(
  candidates: GciFolderEntry[],
  cardStats: CardScanStats,
): Set<string> {
  return deriveSelectionFromOverrides(candidates, cardStats, {});
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
