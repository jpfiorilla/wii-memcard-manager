import { useMemo } from "react";
import {
  Box,
  Checkbox,
  FormGroup,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import type { GciFolderEntry } from "@/types/memcard";
import { formatFolderRelativeTime } from "@/utils/formatFolderRelativeTime";

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
  const sorted = useMemo(
    () =>
      [...candidates].sort(
        (a, b) =>
          b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path, "en"),
      ),
    [candidates],
  );

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
        Newest at top (same order as &quot;Select all importable&quot;).{" "}
        <strong>Checked</strong> = should be on the target <code>.raw</code>{" "}
        (saves already on the card start checked). Uncheck an on-card save to
        remove it on apply; check a new <code>.gci</code> to add it. Times use
        each file&apos;s modified date from the folder.
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

      {sorted.length > 0 && (
        <FormGroup sx={{ gap: 0 }}>
          {sorted.map((c) => {
            const canToggle = !c.parseError;
            const checked = canToggle && selectedPaths.has(c.path);
            const checkbox = (
              <Checkbox
                checked={checked}
                disabled={!canToggle}
                onChange={(_, v) => onTogglePath(c.path, v)}
                size="small"
                color={c.alreadyOnCard && checked ? "success" : "primary"}
                sx={{ p: 0.5 }}
                inputProps={{ "aria-label": c.fileName }}
              />
            );
            const main = (
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ wordBreak: "break-word" }}
                >
                  {c.fileName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {c.saveName && c.saveName !== c.fileName
                    ? `${c.saveName} — `
                    : ""}
                  {c.parseError}
                  {c.alreadyOnCard && !c.parseError && "already on this .raw"}
                </Typography>
              </Box>
            );
            const when = (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  whiteSpace: "nowrap",
                  textAlign: "right",
                  pl: 1,
                }}
              >
                {formatFolderRelativeTime(c.mtimeMs)}
              </Typography>
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
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr) auto",
                    alignItems: "center",
                    columnGap: 1,
                    py: 0.75,
                    borderBottom: 1,
                    borderColor: "divider",
                  }}
                >
                  {checkbox}
                  {main}
                  {when}
                </Box>
              </Tooltip>
            );
          })}
        </FormGroup>
      )}
    </Paper>
  );
}
