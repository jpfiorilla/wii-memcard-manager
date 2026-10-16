import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { PipelineSettingsState } from "@/types/memcard";
import { CharacterIcon, characterLabel } from "./CharacterIcon";
import { WiiSyncSection } from "./WiiSyncSection";

type PipelineSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  pipeline: PipelineSettingsState;
  updatePipeline: (partial: Partial<PipelineSettingsState>) => Promise<void>;
};

const CHARACTER_IDS = Array.from({ length: 26 }, (_, i) => i).sort((a, b) =>
  (characterLabel(a) ?? "").localeCompare(characterLabel(b) ?? ""),
);

export function PipelineSettingsDialog({
  open,
  onClose,
  pipeline,
  updatePipeline,
}: PipelineSettingsDialogProps) {
  const [capDraft, setCapDraft] = useState(String(pipeline.maxReplaysPerCard));
  useEffect(() => setCapDraft(String(pipeline.maxReplaysPerCard)), [pipeline.maxReplaysPerCard]);

  const commitCap = () => {
    const n = Number(capDraft);
    if (Number.isInteger(n) && n >= 1 && n <= 60) void updatePipeline({ maxReplaysPerCard: n });
    else setCapDraft(String(pipeline.maxReplaysPerCard));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="settings-title">
      <DialogTitle id="settings-title">Settings</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField
            label="Recordings on the card"
            type="number"
            size="small"
            value={capDraft}
            onChange={(e) => setCapDraft(e.target.value)}
            onBlur={commitCap}
            helperText="The newest recordings in the folder go on the Wii."
            inputProps={{ min: 1, max: 60 }}
          />

          <TextField
            select
            label="You play"
            size="small"
            value={pipeline.mainCharacter}
            onChange={(e) => void updatePipeline({ mainCharacter: Number(e.target.value) })}
          >
            {CHARACTER_IDS.map((id) => (
              <MenuItem key={id} value={id}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CharacterIcon ckind={id} size={18} />
                  {characterLabel(id)}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={pipeline.autoOrganizeGcis}
                  onChange={(_, v) => void updatePipeline({ autoOrganizeGcis: v })}
                  size="small"
                />
              }
              label="File older recordings by opponent"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 5.5 }}>
              Anything past the newest {pipeline.maxReplaysPerCard} moves into a folder like{" "}
              <code>Falco/</code>. Nothing is deleted.
            </Typography>
          </Box>
        </Stack>
        <WiiSyncSection />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
