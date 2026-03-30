import { useMemo } from "react";
import {
  Box,
  Checkbox,
  FormGroup,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
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
  const theme = useTheme();
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
        minHeight: 0,
        maxHeight: "min(70vh, 560px)",
        [theme.breakpoints.up(400)]: {
          flex: "2 1 0",
          maxHeight: "calc(100vh - 320px)",
        },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <Typography variant="subtitle1" gutterBottom>
          Saves
        </Typography>
        <Typography
          variant="caption"
          display="block"
          color="text.secondary"
          sx={{ mb: 1.5 }}
        >
          Checked = stays on the card after you apply.
        </Typography>

        {!scanning && gciFolder && rawPath && candidates.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No saves in this folder.
          </Typography>
        )}

        {!scanning && (!gciFolder || !rawPath) && (
          <Typography variant="body2" color="text.secondary">
            Choose folder and card above.
          </Typography>
        )}
      </Box>

      {sorted.length > 0 && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            mt: 0.5,
          }}
        >
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
                    ? "On the card now — uncheck to remove."
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
        </Box>
      )}
    </Paper>
  );
}
