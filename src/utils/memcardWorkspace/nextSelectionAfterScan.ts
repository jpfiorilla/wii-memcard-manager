import type { GciFolderEntry } from "@/types/memcard";

/**
 * Recomputes checkbox selection after a folder scan: auto-checks new importable GCIs,
 * preserves user choices where appropriate (see refs in caller).
 */
export function nextSelectionAfterScan(
  prev: Set<string>,
  entries: GciFolderEntry[],
  lastImportable: Set<string>,
  previousPathsSnapshot: Set<string>,
  userTouched: boolean,
): {
  next: Set<string>;
  lastImportable: Set<string>;
  previousPaths: Set<string>;
} {
  const importable = new Set(
    entries
      .filter((e) => !e.parseError && !e.alreadyOnCard)
      .map((e) => e.path),
  );
  const next = new Set<string>();
  const prevPathsStale =
    !userTouched && prev.size === 0 && previousPathsSnapshot.size > 0;
  const prevPaths = prevPathsStale ? new Set<string>() : previousPathsSnapshot;

  for (const p of importable) {
    const brandNewInFolder = !prevPaths.has(p);
    const newlyImportable = !lastImportable.has(p);
    if (brandNewInFolder || newlyImportable) {
      next.add(p);
    } else if (prev.has(p)) {
      next.add(p);
    }
  }
  for (const e of entries) {
    if (e.parseError || !e.alreadyOnCard) continue;
    const p = e.path;
    if (prev.has(p)) {
      next.add(p);
    } else if (!prevPaths.has(p)) {
      next.add(p);
    }
  }
  return {
    next,
    lastImportable: importable,
    previousPaths: new Set(entries.map((e) => e.path)),
  };
}
