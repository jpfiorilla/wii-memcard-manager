import { useState } from "react";
import { Box, Button, LinearProgress, Paper, Skeleton, Typography } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { useSnackbar } from "notistack";
import { useAppSettings } from "@/hooks/useAppSettings";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useMemcardIpcListeners } from "@/hooks/memcard/useMemcardIpcListeners";
import { PipelineSettingsDialog } from "@/components/memcard/PipelineSettingsDialog";
import { AppHeader } from "@/components/playlists/AppHeader";
import { PlaylistPicker } from "@/components/playlists/PlaylistPicker";
import { OnTheCard } from "@/components/playlists/OnTheCard";
import { PlaylistDialog } from "@/components/playlists/PlaylistDialog";
import type { CustomPlaylist } from "@/components/playlists/types";

export default function App() {
  const { enqueueSnackbar } = useSnackbar();
  useMemcardIpcListeners(enqueueSnackbar);
  const settings = useAppSettings();
  const playlists = usePlaylists();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; editing: CustomPlaylist | null }>({ open: false, editing: null });

  const view = playlists.view;
  const openEdit = async (id: string) => {
    const s = await window.memcard.getUserSettings();
    const p = s.customPlaylists.find((c) => c.id === id);
    if (p) setDialog({ open: true, editing: p });
  };
  const pickFolder = async () => {
    await settings.pickGciFolder();
    await playlists.refresh();
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", gap: 2.5 }}>
      <AppHeader activeName={view?.folder ? view.activeName : null} onOpenSettings={() => setSettingsOpen(true)} />

      {settings.pipeline && (
        <PipelineSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          pipeline={settings.pipeline}
          updatePipeline={settings.updatePipeline}
        />
      )}

      <Box sx={{ height: 4 }}>{playlists.loading && view && <LinearProgress aria-label="Reading recordings" />}</Box>

      {!settings.hydrated || !view ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 420px" }, gap: 2.5 }}>
          <Skeleton variant="rounded" height={420} />
          <Skeleton variant="rounded" height={420} />
        </Box>
      ) : !view.folder ? (
        <Paper
          elevation={0}
          sx={{ p: 4, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, maxWidth: 560 }}
        >
          <Typography variant="h6" component="h2">
            Where do your recordings sync to?
          </Typography>
          <Typography color="text.secondary">
            Pick the folder your TM:CE .gci recordings land in (for example a Google Drive folder). Playlists choose
            which of them go on the card the Wii downloads.
          </Typography>
          <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={() => void pickFolder()}>
            Choose folder
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 420px" },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          <PlaylistPicker
            view={view}
            onSelect={(id) => void playlists.select(id)}
            onNew={() => setDialog({ open: true, editing: null })}
            onEdit={(p) => void openEdit(p.id)}
            onIncludeArchive={(v) => void playlists.setIncludeArchive(v)}
            onChangeFolder={() => void pickFolder()}
          />
          <Box sx={{ position: { md: "sticky" }, top: { md: 24 }, display: "flex", maxHeight: { md: "calc(100vh - 48px)" }, minHeight: 0 }}>
            <OnTheCard view={view} />
          </Box>
        </Box>
      )}

      {view && (
        <PlaylistDialog
          open={dialog.open}
          editing={dialog.editing}
          view={view}
          onClose={() => setDialog((d) => ({ ...d, open: false }))}
          onSave={async (p) => {
            const saved = await playlists.save(p);
            if (saved && !p.id) await playlists.select(saved.id);
            return Boolean(saved);
          }}
          onDelete={playlists.remove}
        />
      )}
    </Box>
  );
}
