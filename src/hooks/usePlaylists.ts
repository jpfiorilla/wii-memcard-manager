/** The playlists, which one is active, and what it puts on the card. Kept in sync with the main process. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSnackbar } from "notistack";
import type { CustomPlaylist, PlaylistView } from "@/vite-env";

const FOLDER_REFRESH_DEBOUNCE_MS = 1000;

export function usePlaylists() {
  const { enqueueSnackbar } = useSnackbar();
  const [view, setView] = useState<PlaylistView | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const v = await window.memcard.getPlaylistView();
      if (mine === seq.current) setView(v);
    } catch (e) {
      enqueueSnackbar(`Could not read the recordings folder: ${e instanceof Error ? e.message : String(e)}`, {
        variant: "error",
      });
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void refresh();
    const offChanged = window.memcard.onPlaylistsChanged(() => void refresh());
    let t: ReturnType<typeof setTimeout> | null = null;
    const offFolder = window.memcard.onFolderChanged(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void refresh(), FOLDER_REFRESH_DEBOUNCE_MS);
    });
    return () => {
      offChanged();
      offFolder();
      if (t) clearTimeout(t);
    };
  }, [refresh]);

  const select = useCallback(async (id: string) => {
    setView((v) => (v ? { ...v, active: id } : v));
    await window.memcard.setActivePlaylist(id);
  }, []);

  const save = useCallback(
    async (p: Omit<CustomPlaylist, "id"> & { id?: string }) => {
      const r = await window.memcard.savePlaylist(p);
      if (!r.ok) {
        enqueueSnackbar(r.error, { variant: "error" });
        return null;
      }
      return r.playlist;
    },
    [enqueueSnackbar],
  );

  const remove = useCallback(async (id: string) => {
    await window.memcard.deletePlaylist(id);
  }, []);

  const setIncludeArchive = useCallback(async (includeArchive: boolean) => {
    setView((v) => (v ? { ...v, includeArchive } : v));
    await window.memcard.mergeUserSettings({ includeArchive });
  }, []);

  return { view, loading, refresh, select, save, remove, setIncludeArchive };
}
