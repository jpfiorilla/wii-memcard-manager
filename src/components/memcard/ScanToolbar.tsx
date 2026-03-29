import { Box, Button, CircularProgress, Paper, Stack, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SelectAllIcon from "@mui/icons-material/SelectAll";

type ScanToolbarProps = {
  gciFolder: string | null;
  rawPath: string | null;
  scanning: boolean;
  hasImportable: boolean;
  cardStats: { directoryFileCount: number; freeBlocks: number } | null;
  onRescan: () => void;
  onSelectAllImportable: () => void;
};

export function ScanToolbar({
  gciFolder,
  rawPath,
  scanning,
  hasImportable,
  cardStats,
  onRescan,
  onSelectAllImportable,
}: ScanToolbarProps) {
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
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems="stretch"
      >
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void onRescan()}
          disabled={!gciFolder || !rawPath || scanning}
          sx={{
            minWidth: { sm: 140 },
            alignSelf: { xs: "stretch", sm: "center" },
          }}
        >
          Rescan
        </Button>
        <Tooltip title="Selects the newest importable files first (by modified time), stopping when the card runs out of save slots or free blocks.">
          <Box
            sx={{
              display: "flex",
              alignSelf: { xs: "stretch", sm: "center" },
            }}
          >
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<SelectAllIcon />}
              onClick={onSelectAllImportable}
              disabled={
                !gciFolder ||
                !rawPath ||
                scanning ||
                !hasImportable ||
                !cardStats
              }
              sx={{ minWidth: { sm: 160 } }}
            >
              Select all importable
            </Button>
          </Box>
        </Tooltip>
      </Stack>
      {scanning && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Scanning folder…
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
