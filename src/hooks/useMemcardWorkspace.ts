import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSnackbar } from "notistack";
import { MAX_CARD_DIRECTORY_FILES } from "@/constants/card";
import type {
  CardScanStats,
  GciFolderEntry,
  PipelineSettingsState,
} from "@/types/memcard";

export function useMemcardWorkspace() {
  const { enqueueSnackbar } = useSnackbar();
  const [gciFolder, setGciFolder] = useState<string | null>(null);
  const [rawPath, setRawPath] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [watching, setWatching] = useState(false);

  const [candidates, setCandidates] = useState<GciFolderEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [cardStats, setCardStats] = useState<CardScanStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const lastImportableRef = useRef<Set<string>>(new Set());
  const previousPathsRef = useRef<Set<string>>(new Set());
  const userTouchedSelectionRef = useRef(false);
  const scanDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pipeline, setPipeline] = useState<PipelineSettingsState>({
    stagingDir: null,
    gciBatchDebounceMs: 4000,
    nintendontSavesRelativePath: "nintendont/saves",
    autoBuildRaw: true,
    autoCopyToSd: true,
    confirmBeforeSdCopy: false,
  });
  const [pipelineSettingsOpen, setPipelineSettingsOpen] = useState(false);

  useEffect(() => {
    lastImportableRef.current = new Set();
    previousPathsRef.current = new Set();
    userTouchedSelectionRef.current = false;
  }, [gciFolder, rawPath]);

  const runScan = useCallback(async () => {
    if (!rawPath || !gciFolder) {
      setCandidates([]);
      setSelectedPaths(new Set());
      setCardStats(null);
      lastImportableRef.current = new Set();
      previousPathsRef.current = new Set();
      userTouchedSelectionRef.current = false;
      return;
    }
    setScanning(true);
    try {
      const r = await window.memcard.scanGciFolder({ rawPath, gciFolder });
      if (!r.ok) {
        setCandidates([]);
        setCardStats(null);
        enqueueSnackbar(r.error, { variant: "error" });
        return;
      }
      setCandidates(r.entries);
      setCardStats(r.cardStats);
      setSelectedPaths((prev) => {
        const importable = new Set(
          r.entries
            .filter((e) => !e.parseError && !e.alreadyOnCard)
            .map((e) => e.path),
        );
        const next = new Set<string>();
        const prevImp = lastImportableRef.current;
        const prevPathsSnapshot = previousPathsRef.current;
        const prevPathsStale =
          !userTouchedSelectionRef.current &&
          prev.size === 0 &&
          prevPathsSnapshot.size > 0;
        const prevPaths = prevPathsStale
          ? new Set<string>()
          : prevPathsSnapshot;
        for (const p of importable) {
          const brandNewInFolder = !prevPaths.has(p);
          const newlyImportable = !prevImp.has(p);
          if (brandNewInFolder || newlyImportable) {
            next.add(p);
          } else if (prev.has(p)) {
            next.add(p);
          }
        }
        for (const e of r.entries) {
          if (e.parseError || !e.alreadyOnCard) continue;
          const p = e.path;
          if (prev.has(p)) {
            next.add(p);
          } else if (!prevPaths.has(p)) {
            next.add(p);
          }
        }
        lastImportableRef.current = importable;
        previousPathsRef.current = new Set(r.entries.map((e) => e.path));
        return next;
      });
    } finally {
      setScanning(false);
    }
  }, [rawPath, gciFolder, enqueueSnackbar]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await window.memcard.getUserSettings();
      if (cancelled) return;
      if (s.gciFolder) setGciFolder(s.gciFolder);
      if (s.rawPath) setRawPath(s.rawPath);
      if (s.gciFolder && s.folderWatchEnabled) {
        setWatching(true);
      }
      setPipeline({
        stagingDir: s.stagingDir,
        gciBatchDebounceMs: s.gciBatchDebounceMs,
        nintendontSavesRelativePath: s.nintendontSavesRelativePath,
        autoBuildRaw: s.autoBuildRaw,
        autoCopyToSd: s.autoCopyToSd,
        confirmBeforeSdCopy: s.confirmBeforeSdCopy,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.ipcRenderer.on("main-process-message", (_e, msg) => {
      console.log("[main]", msg);
    });
  }, []);

  useEffect(() => {
    const u1 = window.memcard.onBatchBuilt(({ outputs, errors }) => {
      if (outputs.length > 0) {
        enqueueSnackbar(
          `Built ${outputs.length} memory card image(s): ${outputs.map((o) => o.gameCode).join(", ")}`,
          { variant: "success" },
        );
      }
      for (const err of errors) {
        enqueueSnackbar(err, { variant: "warning" });
      }
    });
    const u2 = window.memcard.onBatchBuildError(({ error }) => {
      enqueueSnackbar(`Auto-build failed: ${error}`, { variant: "error" });
    });
    const u3 = window.memcard.onVolumeMounted(({ mountPath, savesDir }) => {
      enqueueSnackbar(`SD / volume ready: ${mountPath} → ${savesDir}`, {
        variant: "info",
      });
    });
    const u4 = window.memcard.onVolumeUnmounted(({ mountPath }) => {
      enqueueSnackbar(`Volume ejected: ${mountPath}`, { variant: "default" });
    });
    const u5 = window.memcard.onSdTransferDone(({ destPath }) => {
      enqueueSnackbar(`Copied to SD: ${destPath}`, { variant: "success" });
    });
    const u6 = window.memcard.onSdTransferError(({ error, localPath }) => {
      enqueueSnackbar(`SD copy failed (${localPath}): ${error}`, {
        variant: "error",
      });
    });
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [enqueueSnackbar]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  useEffect(() => {
    if (!gciFolder) return () => undefined;
    const unsub = window.memcard.onFolderChanged((ev) => {
      const line = `${ev.eventKind} ${ev.filePath}`;
      setEvents((prev) => [line, ...prev].slice(0, 40));
      if (ev.rootDir !== gciFolder || !rawPath) return;
      if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
      scanDebounceRef.current = setTimeout(() => {
        scanDebounceRef.current = null;
        void runScan();
      }, 500);
    });
    return () => {
      unsub();
      if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
    };
  }, [gciFolder, rawPath, runScan]);

  const pickGciFolder = async () => {
    const p = await window.memcard.pickDirectory(gciFolder);
    if (!p) return;
    if (watching && gciFolder) {
      await window.memcard.stopWatch(gciFolder);
      setWatching(false);
    }
    setGciFolder(p);
    await window.memcard.mergeUserSettings({
      gciFolder: p,
      folderWatchEnabled: false,
    });
    enqueueSnackbar(`GCI folder: ${p}`, { variant: "success" });
  };

  const pickRaw = async () => {
    const p = await window.memcard.pickFile();
    if (!p) return;
    setRawPath(p);
    await window.memcard.mergeUserSettings({ rawPath: p });
    enqueueSnackbar(`Output .raw: ${p}`, { variant: "success" });
  };

  const updatePipeline = useCallback(
    async (partial: Partial<PipelineSettingsState>) => {
      setPipeline((p) => ({ ...p, ...partial }));
      await window.memcard.mergeUserSettings(partial);
    },
    [],
  );

  const pickStagingDir = async () => {
    const p = await window.memcard.pickDirectory(pipeline.stagingDir);
    if (!p) return;
    await updatePipeline({ stagingDir: p });
    enqueueSnackbar(`Staging folder: ${p}`, { variant: "success" });
  };

  const togglePath = (path: string, checked: boolean) => {
    userTouchedSelectionRef.current = true;
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  };

  const importSelected = async () => {
    if (!rawPath || !gciFolder) {
      enqueueSnackbar("Choose a GCI folder and target .raw first", {
        variant: "warning",
      });
      return;
    }
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
    if (gciPathsToAdd.length === 0 && gciPathsToRemove.length === 0) {
      enqueueSnackbar(
        "Nothing to apply — checked list already matches the target .raw",
        { variant: "warning" },
      );
      return;
    }
    const res = await window.memcard.syncFolderSelection(rawPath, {
      gciPathsToAdd,
      gciPathsToRemove,
    });
    if (res.ok) {
      const parts: string[] = [];
      if (gciPathsToAdd.length > 0) parts.push(`add ${gciPathsToAdd.length}`);
      if (gciPathsToRemove.length > 0)
        parts.push(`remove ${gciPathsToRemove.length}`);
      enqueueSnackbar(`Applied to memory card (${parts.join(", ")})`, {
        variant: "success",
      });
      await runScan();
    } else {
      enqueueSnackbar(res.error, { variant: "error" });
    }
  };

  const toggleWatch = async () => {
    if (!gciFolder) {
      enqueueSnackbar("Pick a GCI folder first", { variant: "warning" });
      return;
    }
    if (watching) {
      await window.memcard.stopWatch(gciFolder);
      setWatching(false);
      await window.memcard.mergeUserSettings({ folderWatchEnabled: false });
      enqueueSnackbar("Stopped watching", { variant: "default" });
    } else {
      const r = await window.memcard.startWatch(gciFolder);
      if (r?.ok) {
        setWatching(true);
        await window.memcard.mergeUserSettings({ folderWatchEnabled: true });
        enqueueSnackbar("Watching for changes", { variant: "success" });
      } else {
        enqueueSnackbar("Could not start watch", { variant: "error" });
      }
    }
  };

  const testBackup = async () => {
    if (!rawPath) {
      enqueueSnackbar("Pick a .raw file first", { variant: "warning" });
      return;
    }
    const res = await window.memcard.backupBeforeWrite(rawPath);
    if ("skipped" in res && res.skipped) {
      enqueueSnackbar("No existing file to back up", { variant: "info" });
    } else if ("ok" in res && res.ok === true && "backupPath" in res) {
      enqueueSnackbar(`Backup → ${res.backupPath}`, { variant: "success" });
    } else if ("ok" in res && res.ok === false && "error" in res) {
      enqueueSnackbar(res.error, { variant: "error" });
    }
  };

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

  const selectionInvalidReason = useMemo(() => {
    if (!cardStats) return null;
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
  }, [cardStats, candidates, selectedPaths]);

  const importButtonTooltip = useMemo(() => {
    if (!rawPath)
      return "Choose a target Nintendont .raw file in the Target section above.";
    if (!gciFolder)
      return "Choose a folder of .gci files in the Source section above.";
    if (selectionInvalidReason) return selectionInvalidReason;
    if (pendingChangeCount > 0) return "";
    return "Check or uncheck rows so the list matches what you want on the target .raw, then apply.";
  }, [rawPath, gciFolder, selectionInvalidReason, pendingChangeCount]);

  const selectAllImportable = () => {
    if (!cardStats) return;
    const next = new Set<string>();
    for (const c of candidates) {
      if (c.parseError) continue;
      if (c.alreadyOnCard) {
        next.add(c.path);
      }
    }
    let usedSlots = 0;
    let usedBlocks = 0;
    const { directoryFileCount: dirCount, freeBlocks } = cardStats;
    for (const c of candidates) {
      if (c.parseError || c.alreadyOnCard) continue;
      if (dirCount + usedSlots + 1 > MAX_CARD_DIRECTORY_FILES) break;
      if (usedBlocks + c.blockCount > freeBlocks) break;
      next.add(c.path);
      usedSlots += 1;
      usedBlocks += c.blockCount;
    }
    setSelectedPaths(next);
  };

  const importDisabled =
    !rawPath ||
    !gciFolder ||
    pendingChangeCount === 0 ||
    selectionInvalidReason != null;

  return {
    gciFolder,
    rawPath,
    events,
    watching,
    candidates,
    selectedPaths,
    cardStats,
    scanning,
    pipeline,
    setPipeline,
    pipelineSettingsOpen,
    setPipelineSettingsOpen,
    runScan,
    pickGciFolder,
    pickRaw,
    updatePipeline,
    pickStagingDir,
    togglePath,
    importSelected,
    toggleWatch,
    testBackup,
    pendingAddCount,
    pendingRemoveCount,
    pendingChangeCount,
    selectedForSummary,
    pendingRemovalSummary,
    checkedOnCardSummary,
    hasImportable,
    selectionInvalidReason,
    importButtonTooltip,
    selectAllImportable,
    importDisabled,
  };
}
