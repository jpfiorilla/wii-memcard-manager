import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Tooltip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import SelectAllIcon from "@mui/icons-material/SelectAll";

type ScanToolbarProps = {
  gciFolder: string | null;
  rawPath: string | null;
  scanning: boolean;
  cardStats: { directoryFileCount: number; freeBlocks: number } | null;
  onRescan: () => void;
  onSelectAllImportable: () => void | Promise<void>;
};

export function ScanToolbar({
  gciFolder,
  rawPath,
  scanning,
  cardStats,
  onRescan,
  onSelectAllImportable,
}: ScanToolbarProps) {
  const theme = useTheme();

  return (
    <Paper
      elevation={3}
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        mb: 2,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "rgba(255, 20, 147, 0.35)",
        background: (t) =>
          `linear-gradient(180deg, ${t.palette.background.paper} 0%, rgba(13, 2, 33, 0.97) 100%)`,
        backdropFilter: "blur(8px)",
      }}
    >
      <Stack
        direction="row"
        flexWrap="wrap"
        spacing={1.5}
        alignItems="center"
        useFlexGap
      >
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void onRescan()}
          disabled={!gciFolder || !rawPath || scanning}
          sx={{ minWidth: { sm: 140 } }}
        >
          Rescan
        </Button>
        <Tooltip title="Clears forced include/exclude so automatic picks use newest-first importable rules only.">
          <span>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<SelectAllIcon />}
              onClick={() => void onSelectAllImportable()}
              disabled={!gciFolder || !rawPath || scanning || !cardStats}
              sx={{ minWidth: { sm: 160 } }}
            >
              Reset overrides
            </Button>
          </span>
        </Tooltip>
        {scanning && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              // CircularProgress uses stroke: currentColor on the root; default color="primary"
              // forces palette.primary.main via MUI styles and overrides naive sx. Inherit from here.
              color: theme.palette.primary.light,
            }}
            aria-live="polite"
          >
            <CircularProgress
              color="inherit"
              size={20}
              thickness={4}
              aria-label="Scanning folder"
            />
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
