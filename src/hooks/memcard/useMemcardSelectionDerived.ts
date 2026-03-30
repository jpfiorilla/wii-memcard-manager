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
      importButtonTooltip =
        "Choose a target Nintendont .raw file in the Target section above.";
    } else if (!gciFolder) {
      importButtonTooltip =
        "Choose a folder of .gci files in the Source section above.";
    } else if (invalid) {
      importButtonTooltip = invalid;
    } else if (pendingChangeCount > 0) {
      importButtonTooltip = "";
    } else {
      importButtonTooltip =
        "Check or uncheck rows so the list matches what you want on the target .raw, then apply.";
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
