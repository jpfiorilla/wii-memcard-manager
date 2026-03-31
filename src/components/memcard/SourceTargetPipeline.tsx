import {
  Box,
  Button,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
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

function lastPathSegment(p: string) {
  const s = p.replace(/[/\\]+$/, "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  return i >= 0 ? s.slice(i + 1) : s;
}

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
  const theme = useTheme();
  const pipelineReady = Boolean(gciFolder && rawPath);
  const t = theme.transitions.duration.standard;

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        overflow: "hidden",
        background:
          "linear-gradient(135deg, rgba(177, 156, 217, 0.08) 0%, rgba(255, 20, 147, 0.06) 100%)",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Collapse in={!pipelineReady} timeout={t} unmountOnExit>
        <Box sx={{ p: 2 }}>
          <Stack
            spacing={0}
            alignItems="stretch"
            sx={{
              position: "relative",
              flexDirection: "column",
              [theme.breakpoints.up(400)]: {
                flexDirection: "row",
              },
            }}
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
                Folder of saves
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
                  Not set
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
                borderBottom: "4px solid",
                borderColor: "primary.main",
                [theme.breakpoints.up(400)]: {
                  borderBottom: "none",
                  borderRight: "4px solid",
                },
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
                Card file (.raw)
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
                  Not set
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>
      </Collapse>

      <Collapse in={pipelineReady} timeout={t} unmountOnExit>
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            minHeight: 48,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, letterSpacing: "0.08em", flexShrink: 0 }}
          >
            Pipeline
          </Typography>
          <Tooltip title={gciFolder ?? ""}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ minWidth: 0, maxWidth: isNarrow ? "100%" : 280 }}
            >
              <FolderOpenIcon sx={{ fontSize: 18, color: "secondary.light", flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                {gciFolder ? lastPathSegment(gciFolder) : ""}
              </Typography>
            </Stack>
          </Tooltip>
          <Typography variant="body2" color="text.disabled" sx={{ flexShrink: 0 }}>
            →
          </Typography>
          <Tooltip title={rawPath ?? ""}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ minWidth: 0, maxWidth: isNarrow ? "100%" : 320 }}
            >
              <SaveIcon sx={{ fontSize: 18, color: "primary.light", flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                {rawPath ? lastPathSegment(rawPath) : ""}
              </Typography>
            </Stack>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 8 }} />
          <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
            <Tooltip title="Change source folder">
              <IconButton size="small" onClick={onPickGciFolder} color="secondary" aria-label="Change source folder">
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Change memory card (.raw)">
              <IconButton size="small" onClick={onPickRaw} color="primary" aria-label="Change memory card file">
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button size="small" variant="outlined" onClick={onToggleWatch} disabled={!gciFolder}>
              {watching ? "Stop watch" : "Watch"}
            </Button>
            <Button size="small" variant="text" onClick={onTestBackup}>
              Test backup
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}
