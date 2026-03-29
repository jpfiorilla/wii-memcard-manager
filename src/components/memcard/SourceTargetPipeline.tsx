import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import { PipelineArrow } from "./PipelineArrow";

type SourceTargetPipelineProps = {
  isNarrow: boolean;
  gciFolder: string | null;
  rawPath: string | null;
  watching: boolean;
  onPickGciFolder: () => void;
  onToggleWatch: () => void;
  onPickRaw: () => void;
  onTestBackup: () => void;
};

export function SourceTargetPipeline({
  isNarrow,
  gciFolder,
  rawPath,
  watching,
  onPickGciFolder,
  onToggleWatch,
  onPickRaw,
  onTestBackup,
}: SourceTargetPipelineProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        background:
          "linear-gradient(135deg, rgba(177, 156, 217, 0.08) 0%, rgba(255, 20, 147, 0.06) 100%)",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={0}
        alignItems="stretch"
        sx={{ position: "relative" }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            p: 2,
            borderRadius: 1,
            borderLeft: "4px solid",
            borderColor: "secondary.main",
            bgcolor: "rgba(177, 156, 217, 0.06)",
          }}
        >
          <Typography
            variant="overline"
            color="secondary.light"
            sx={{ letterSpacing: "0.12em" }}
          >
            Source
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 0.5, mb: 1 }}>
            .gci folder
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              startIcon={<FolderOpenIcon />}
              variant="contained"
              color="secondary"
              onClick={onPickGciFolder}
            >
              Choose folder
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onToggleWatch}
              disabled={!gciFolder}
            >
              {watching ? "Stop watch" : "Watch"}
            </Button>
          </Stack>
          {gciFolder ? (
            <Typography
              variant="body2"
              sx={{ mt: 1.5, wordBreak: "break-all", opacity: 0.92 }}
            >
              {gciFolder}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Not set — choose where new <code>.gci</code> files land.
            </Typography>
          )}
        </Box>

        <PipelineArrow isNarrow={isNarrow} />

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            p: 2,
            borderRadius: 1,
            borderRight: { md: "4px solid" },
            borderBottom: { xs: "4px solid", md: "none" },
            borderColor: "primary.main",
            bgcolor: "rgba(255, 20, 147, 0.05)",
          }}
        >
          <Typography
            variant="overline"
            color="primary.light"
            sx={{ letterSpacing: "0.12em" }}
          >
            Target
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 0.5, mb: 1 }}>
            Nintendont .raw
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              startIcon={<SaveIcon />}
              variant="outlined"
              color="primary"
              onClick={onPickRaw}
            >
              Choose .raw
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={onTestBackup}
              disabled={!rawPath}
            >
              Test backup
            </Button>
          </Stack>
          {rawPath ? (
            <Typography
              variant="body2"
              sx={{ mt: 1.5, wordBreak: "break-all", opacity: 0.92 }}
            >
              {rawPath}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Not set — choose the card file to update.
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
