import type { GciFolderEntry } from "@/types/memcard";

/** Paths to add/remove on the target .raw for the current checkbox state (newest adds first). */
export function gciPathsForSync(
  candidates: GciFolderEntry[],
  selectedPaths: Set<string>,
): { gciPathsToAdd: string[]; gciPathsToRemove: string[] } {
  const gciPathsToAdd = candidates
    .filter(
      (c) => selectedPaths.has(c.path) && !c.alreadyOnCard && !c.parseError,
    )
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((c) => c.path);
  const gciPathsToRemove = candidates
    .filter(
      (c) => !selectedPaths.has(c.path) && c.alreadyOnCard && !c.parseError,
    )
    .map((c) => c.path);
  return { gciPathsToAdd, gciPathsToRemove };
}
