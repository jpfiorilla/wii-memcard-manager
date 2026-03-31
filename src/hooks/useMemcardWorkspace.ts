/**
 * Composes folder scan, checklist selection, pipeline settings, and IPC actions for the memcard UI.
 * Pure logic lives in `@/utils/memcardWorkspace/*` and `@/hooks/memcard/*`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSnackbar } from "notistack";
import type {
  CardScanStats,
  GciFolderEntry,
  GciFilenameSanitizeStyle,
  PipelineSettingsState,
} from "@/types/memcard";
import { nextSelectionAfterScan } from "@/utils/memcardWorkspace/nextSelectionAfterScan";
import { gciPathsForSync } from "@/utils/memcardWorkspace/gciPathsForSync";
import { selectionSetForSelectAllImportable } from "@/utils/selectAllImportable";
import { useMemcardIpcListeners } from "@/hooks/memcard/useMemcardIpcListeners";
import { useMemcardSelectionDerived } from "@/hooks/memcard/useMemcardSelectionDerived";

const FOLDER_SCAN_DEBOUNCE_MS = 500;

export type RunScanOptions = {
  /** After a successful scan, replace selection with the same set as "Select all importable". */
  selectAllImportableAfter?: boolean;
};

export function useMemcardWorkspace() {
  const { enqueueSnackbar } = useSnackbar();
  useMemcardIpcListeners(enqueueSnackbar);

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
    gciFilenameSanitize: "none",
    notificationsEnabled: true,
  });
  const [pipelineSettingsOpen, setPipelineSettingsOpen] = useState(false);
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  useEffect(() => {
    lastImportableRef.current = new Set();
    previousPathsRef.current = new Set();
    userTouchedSelectionRef.current = false;
  }, [gciFolder, rawPath]);

  const runScan = useCallback(async (options?: RunScanOptions) => {
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

      if (options?.selectAllImportableAfter && r.cardStats) {
        userTouchedSelectionRef.current = false;
        const importable = new Set(
          r.entries
            .filter((e) => !e.parseError && !e.alreadyOnCard)
            .map((e) => e.path),
        );
        lastImportableRef.current = importable;
        previousPathsRef.current = new Set(r.entries.map((e) => e.path));
        setSelectedPaths(
          selectionSetForSelectAllImportable(r.entries, r.cardStats),
        );
      } else {
        setSelectedPaths((prev) => {
          const { next, lastImportable, previousPaths } = nextSelectionAfterScan(
            prev,
            r.entries,
            lastImportableRef.current,
            previousPathsRef.current,
            userTouchedSelectionRef.current,
          );
          lastImportableRef.current = lastImportable;
          previousPathsRef.current = previousPaths;
          return next;
        });
      }
    } finally {
      setScanning(false);
    }
  }, [rawPath, gciFolder, enqueueSnackbar]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
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
          gciFilenameSanitize: (s.gciFilenameSanitize ??
            "none") as GciFilenameSanitizeStyle,
          notificationsEnabled: s.notificationsEnabled,
        });
      } finally {
        if (!cancelled) setSettingsHydrated(true);
      }
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
      }, FOLDER_SCAN_DEBOUNCE_MS);
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
    const r = await window.memcard.startWatch(p);
    if (r?.ok) {
      setWatching(true);
      await window.memcard.mergeUserSettings({
        gciFolder: p,
        folderWatchEnabled: true,
      });
      enqueueSnackbar(`GCI folder: ${p} (watching)`, { variant: "success" });
    } else {
      await window.memcard.mergeUserSettings({
        gciFolder: p,
        folderWatchEnabled: false,
      });
      enqueueSnackbar("Could not start folder watch", { variant: "error" });
    }
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
      setPipeline((prev) => ({ ...prev, ...partial }));
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
    const { gciPathsToAdd, gciPathsToRemove } = gciPathsForSync(
      candidates,
      selectedPaths,
    );
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

  const selectAllImportable = () => {
    if (!cardStats) return;
    setSelectedPaths(selectionSetForSelectAllImportable(candidates, cardStats));
  };

  const derived = useMemcardSelectionDerived(
    candidates,
    selectedPaths,
    cardStats,
    rawPath,
    gciFolder,
  );

  return {
    gciFolder,
    rawPath,
    settingsHydrated,
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
    pendingAddCount: derived.pendingAddCount,
    pendingRemoveCount: derived.pendingRemoveCount,
    pendingChangeCount: derived.pendingChangeCount,
    selectedForSummary: derived.selectedForSummary,
    pendingRemovalSummary: derived.pendingRemovalSummary,
    checkedOnCardSummary: derived.checkedOnCardSummary,
    hasImportable: derived.hasImportable,
    selectionInvalidReason: derived.selectionInvalidReason,
    importButtonTooltip: derived.importButtonTooltip,
    selectAllImportable,
    importDisabled: derived.importDisabled,
  };
}
