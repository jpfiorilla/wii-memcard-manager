/** Settings the window edits directly: the recordings folder and the settings dialog's options. */
import { useCallback, useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import type { GciFilenameSanitizeStyle, PipelineSettingsState } from "@/types/memcard";

export function useAppSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const [hydrated, setHydrated] = useState(false);
  const [gciFolder, setGciFolder] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineSettingsState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await window.memcard.getUserSettings();
        if (cancelled) return;
        setGciFolder(s.gciFolder);
        setPipeline({
          stagingDir: s.stagingDir,
          gciBatchDebounceMs: s.gciBatchDebounceMs,
          nintendontSavesRelativePath: s.nintendontSavesRelativePath,
          autoBuildRaw: s.autoBuildRaw,
          autoCopyToSd: s.autoCopyToSd,
          confirmBeforeSdCopy: s.confirmBeforeSdCopy,
          gciFilenameSanitize: (s.gciFilenameSanitize ?? "none") as GciFilenameSanitizeStyle,
          notificationsEnabled: s.notificationsEnabled,
          wiiSyncEnabled: s.wiiSyncEnabled,
          wiiSyncPort: s.wiiSyncPort,
          maxReplaysPerCard: s.maxReplaysPerCard,
          autoOrganizeGcis: s.autoOrganizeGcis,
          mainCharacter: s.mainCharacter,
        });
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePipeline = useCallback(async (partial: Partial<PipelineSettingsState>) => {
    setPipeline((prev) => (prev ? { ...prev, ...partial } : prev));
    await window.memcard.mergeUserSettings(partial);
  }, []);

  /** Choose the folder recordings sync to, and keep watching it. */
  const pickGciFolder = useCallback(async () => {
    const p = await window.memcard.pickDirectory(gciFolder);
    if (!p) return;
    if (gciFolder) await window.memcard.stopWatch(gciFolder);
    setGciFolder(p);
    const r = await window.memcard.startWatch(p);
    await window.memcard.mergeUserSettings({ gciFolder: p, folderWatchEnabled: Boolean(r?.ok) });
    if (!r?.ok) enqueueSnackbar("Could not watch that folder for new recordings", { variant: "error" });
  }, [gciFolder, enqueueSnackbar]);

  return { hydrated, gciFolder, pipeline, updatePipeline, pickGciFolder };
}
