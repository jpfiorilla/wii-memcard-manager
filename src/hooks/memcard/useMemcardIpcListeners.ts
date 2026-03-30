import { useEffect } from "react";
import type { useSnackbar } from "notistack";

type Enqueue = ReturnType<typeof useSnackbar>["enqueueSnackbar"];

/**
 * Subscribes to main-process memcard events (batch build, SD volume, transfers) and shows toasts.
 */
export function useMemcardIpcListeners(enqueueSnackbar: Enqueue) {
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
}
