import type { Dispatch, SetStateAction } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import type { PipelineSettingsState } from "@/types/memcard";

type PipelineSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  pipeline: PipelineSettingsState;
  setPipeline: Dispatch<SetStateAction<PipelineSettingsState>>;
  onPickStagingDir: () => void;
  updatePipeline: (partial: Partial<PipelineSettingsState>) => Promise<void>;
};

export function PipelineSettingsDialog({
  open,
  onClose,
  pipeline,
  setPipeline,
  onPickStagingDir,
  updatePipeline,
}: PipelineSettingsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="pipeline-settings-title"
    >
      <DialogTitle id="pipeline-settings-title">
        Background pipeline (macOS SD)
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Optional automation. After a quiet period in the watched folder, new
          saves are merged into staging <code>.raw</code> files (one per game
          code). When a volume with <code>nintendont/saves</code> appears,
          pending images copy there (existing files go to{" "}
          <code>backups/</code> on the SD first).
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={pipeline.notificationsEnabled}
              onChange={(_, v) => void updatePipeline({ notificationsEnabled: v })}
              size="small"
            />
          }
          label="Notifications (system + in-app toasts for pipeline events)"
          sx={{ mb: 1, alignItems: "flex-start" }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          When off, no Notification Center alerts and no toasts for batch builds, SD
          copy, or volume mount. System notifications never play a sound.
        </Typography>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ sm: "center" }}
            flexWrap="wrap"
          >
            <Button
              size="small"
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={() => void onPickStagingDir()}
            >
              Staging folder
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ wordBreak: "break-all", flex: 1 }}
            >
              {pipeline.stagingDir ?? "Default: app data / staging"}
            </Typography>
          </Stack>
          <FormControl size="small" sx={{ maxWidth: 420 }}>
            <InputLabel id="gci-filename-sanitize-label">
              GCI filename on import
            </InputLabel>
            <Select
              labelId="gci-filename-sanitize-label"
              label="GCI filename on import"
              value={pipeline.gciFilenameSanitize}
              onChange={(e) =>
                void updatePipeline({
                  gciFilenameSanitize: e.target.value as PipelineSettingsState["gciFilenameSanitize"],
                })
              }
            >
              <MenuItem value="none">Keep as in file (default)</MenuItem>
              <MenuItem value="tmce-short">TM:CE short slugs + length cap</MenuItem>
              <MenuItem value="ascii-title">ASCII title case (per segment)</MenuItem>
              <MenuItem value="ascii-upper">ASCII UPPER</MenuItem>
              <MenuItem value="ascii-lower">ASCII lower</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -0.5 }}>
            TM:CE mode rewrites names to short fighter slugs (Zelda is stored as sheik) and caps total
            length so labels fit in-game. Renaming can break saves that reference the dentry string —
            use &quot;Keep as in file&quot; unless you know it is safe.
          </Typography>
          <TextField
            label="Quiet period before build (ms)"
            type="number"
            size="small"
            sx={{ maxWidth: 280 }}
            value={pipeline.gciBatchDebounceMs}
            onChange={(e) =>
              setPipeline((p) => ({
                ...p,
                gciBatchDebounceMs: Number(e.target.value) || 4000,
              }))
            }
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 500)
                void updatePipeline({ gciBatchDebounceMs: n });
            }}
          />
          <TextField
            label="Path on SD (relative to volume)"
            size="small"
            fullWidth
            value={pipeline.nintendontSavesRelativePath}
            onChange={(e) =>
              setPipeline((p) => ({
                ...p,
                nintendontSavesRelativePath: e.target.value,
              }))
            }
            onBlur={(e) =>
              void updatePipeline({
                nintendontSavesRelativePath: e.target.value,
              })
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={pipeline.autoBuildRaw}
                onChange={(_, v) => void updatePipeline({ autoBuildRaw: v })}
                size="small"
              />
            }
            label="Auto-build .raw from new GCIs (when Watch is on)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={pipeline.autoCopyToSd}
                onChange={(_, v) => void updatePipeline({ autoCopyToSd: v })}
                size="small"
              />
            }
            label="Auto-copy staging images to SD when mounted"
          />
          <FormControlLabel
            control={
              <Switch
                checked={pipeline.confirmBeforeSdCopy}
                onChange={(_, v) =>
                  void updatePipeline({ confirmBeforeSdCopy: v })
                }
                size="small"
              />
            }
            label="Confirm each file before SD copy (dialog)"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
