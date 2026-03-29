import {
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import type { GciFolderEntry } from "@/types/memcard";

type GciCandidateListProps = {
  candidates: GciFolderEntry[];
  selectedPaths: Set<string>;
  scanning: boolean;
  gciFolder: string | null;
  rawPath: string | null;
  onTogglePath: (path: string, checked: boolean) => void;
};

export function GciCandidateList({
  candidates,
  selectedPaths,
  scanning,
  gciFolder,
  rawPath,
  onTogglePath,
}: GciCandidateListProps) {
  return (
    <Paper
      sx={{
        p: 2,
        flex: 1,
        width: "100%",
        minWidth: 0,
        maxHeight: { lg: "calc(100vh - 320px)" },
        overflow: "auto",
      }}
    >
      <Typography variant="subtitle1" gutterBottom>
        Saves in folder
      </Typography>
      <Typography
        variant="caption"
        display="block"
        color="text.secondary"
        sx={{ mb: 1.5 }}
      >
        Newest first. <strong>Checked</strong> = should be on the target{" "}
        <code>.raw</code> (saves already on the card start checked). Uncheck
        an on-card save to remove it on apply; check a new <code>.gci</code> to
        add it.
      </Typography>

      {!scanning && gciFolder && rawPath && candidates.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No .gci files in this folder.
        </Typography>
      )}

      {!scanning && (!gciFolder || !rawPath) && (
        <Typography variant="body2" color="text.secondary">
          Set source and target above to list saves.
        </Typography>
      )}

      {candidates.length > 0 && (
        <FormGroup>
          {candidates.map((c) => {
            const canToggle = !c.parseError;
            const checked = canToggle && selectedPaths.has(c.path);
            const rowLabel = (
              <Box>
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ wordBreak: "break-all" }}
                >
                  {c.fileName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {c.saveName && c.saveName !== c.fileName ? `${c.saveName} — ` : ""}
                  {c.parseError}
                  {c.alreadyOnCard && !c.parseError && "already on this .raw"}
                </Typography>
              </Box>
            );
            const checkbox = (
              <Checkbox
                checked={checked}
                disabled={!canToggle}
                onChange={(_, v) => onTogglePath(c.path, v)}
                size="small"
                color={c.alreadyOnCard && checked ? "success" : "primary"}
              />
            );
            return (
              <Tooltip
                key={c.path}
                title={
                  c.alreadyOnCard && !c.parseError
                    ? "On the target .raw now. Uncheck to remove this save when you apply."
                    : ""
                }
                disableHoverListener={!c.alreadyOnCard || !!c.parseError}
              >
                <FormControlLabel
                  control={checkbox}
                  label={rowLabel}
                  sx={{
                    alignItems: "flex-start",
                    ml: 0,
                    "& .MuiFormControlLabel-label": { pt: 0.25 },
                  }}
                />
              </Tooltip>
            );
          })}
        </FormGroup>
      )}
    </Paper>
  );
}
