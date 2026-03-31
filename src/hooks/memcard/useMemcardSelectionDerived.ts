import { useMemo } from "react";
import type { GciFolderEntry } from "@/types/memcard";
import type { CardScanStats } from "@/types/memcard";
import { selectionInvalidReason } from "@/utils/memcardWorkspace/selectionInvalidReason";

type Derived = {
  pendingAddCount: number;
  pendingRemoveCount: number;
  pendingChangeCount: number;
  selectedForSummary: GciFolderEntry[];
  pendingRemovalSummary: GciFolderEntry[];
  checkedOnCardSummary: GciFolderEntry[];
  hasImportable: boolean;
  selectionInvalidReason: string | null;
  importButtonTooltip: string;
  importDisabled: boolean;
};

/**
 * Memoized counts, summaries, and validation for the GCI checklist + Apply button.
 */
export function useMemcardSelectionDerived(
  candidates: GciFolderEntry[],
  selectedPaths: Set<string>,
  cardStats: CardScanStats | null,
  rawPath: string | null,
  gciFolder: string | null,
): Derived {
  return useMemo(() => {
    const pendingAddCount = candidates.filter(
      (c) => selectedPaths.has(c.path) && !c.alreadyOnCard && !c.parseError,
    ).length;
    const pendingRemoveCount = candidates.filter(
      (c) => !selectedPaths.has(c.path) && c.alreadyOnCard && !c.parseError,
    ).length;
    const pendingChangeCount = pendingAddCount + pendingRemoveCount;

    const selectedForSummary = candidates.filter(
      (c) => selectedPaths.has(c.path) && !c.alreadyOnCard && !c.parseError,
    );
    const pendingRemovalSummary = candidates.filter(
      (c) => !selectedPaths.has(c.path) && c.alreadyOnCard && !c.parseError,
    );
    const checkedOnCardSummary = candidates.filter(
      (c) => selectedPaths.has(c.path) && c.alreadyOnCard && !c.parseError,
    );
    const hasImportable = candidates.some(
      (c) => !c.parseError && !c.alreadyOnCard,
    );

    const invalid =
      cardStats === null
        ? null
        : selectionInvalidReason(cardStats, candidates, selectedPaths);

    let importButtonTooltip: string;
    if (!rawPath) {
      importButtonTooltip = "Pick a .raw file (Target).";
    } else if (!gciFolder) {
      importButtonTooltip = "Pick a folder (Source).";
    } else if (invalid) {
      importButtonTooltip = invalid;
    } else if (pendingChangeCount > 0) {
      importButtonTooltip = "";
    } else {
      importButtonTooltip = "Change overrides or wait for a different plan first.";
    }

    const importDisabled =
      !rawPath ||
      !gciFolder ||
      pendingChangeCount === 0 ||
      invalid != null;

    return {
      pendingAddCount,
      pendingRemoveCount,
      pendingChangeCount,
      selectedForSummary,
      pendingRemovalSummary,
      checkedOnCardSummary,
      hasImportable,
      selectionInvalidReason: invalid,
      importButtonTooltip,
      importDisabled,
    };
  }, [candidates, selectedPaths, cardStats, rawPath, gciFolder]);
}
