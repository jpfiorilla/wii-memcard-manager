import { useEffect } from "react";
import type { useSnackbar } from "notistack";

type Enqueue = ReturnType<typeof useSnackbar>["enqueueSnackbar"];

/**
 * Subscribes to main-process memcard events (batch build, SD volume, transfers) and shows toasts
 * when `notificationsEnabled` is on (same setting as system notifications in pipeline settings).
 */
export function useMemcardIpcListeners(enqueueSnackbar: Enqueue) {
  useEffect(() => {
    const u1 = window.memcard.onBatchBuilt(async ({ outputs, errors }) => {
      const s = await window.memcard.getUserSettings();
      if (!s.notificationsEnabled) return;
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
    const u2 = window.memcard.onBatchBuildError(async ({ error }) => {
      const s = await window.memcard.getUserSettings();
      if (!s.notificationsEnabled) return;
      enqueueSnackbar(`Auto-build failed: ${error}`, { variant: "error" });
    });
    const u3 = window.memcard.onVolumeMounted(async ({ mountPath, savesDir }) => {
      const s = await window.memcard.getUserSettings();
      if (!s.notificationsEnabled) return;
      enqueueSnackbar(`SD / volume ready: ${mountPath} → ${savesDir}`, {
        variant: "info",
      });
    });
    const u4 = window.memcard.onVolumeUnmounted(async ({ mountPath }) => {
      const s = await window.memcard.getUserSettings();
      if (!s.notificationsEnabled) return;
      enqueueSnackbar(`Volume ejected: ${mountPath}`, { variant: "default" });
    });
    const u5 = window.memcard.onSdTransferDone(async ({ destPath }) => {
      const s = await window.memcard.getUserSettings();
      if (!s.notificationsEnabled) return;
      enqueueSnackbar(`Copied to SD: ${destPath}`, { variant: "success" });
    });
    const u6 = window.memcard.onSdTransferError(async ({ error, localPath }) => {
      const s = await window.memcard.getUserSettings();
      if (!s.notificationsEnabled) return;
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
}
