import { Box, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";

type MemcardAppHeaderProps = {
  isXs: boolean;
  importButtonTooltip: string;
  importDisabled: boolean;
  pendingChangeCount: number;
  onOpenPipelineSettings: () => void;
  onImport: () => void;
};

export function MemcardAppHeader({
  isXs,
  importButtonTooltip,
  importDisabled,
  pendingChangeCount,
  onOpenPipelineSettings,
  onImport,
}: MemcardAppHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      alignItems={{ xs: "stretch", sm: "flex-start" }}
      justifyContent="space-between"
      sx={{ mb: 1 }}
    >
      <Typography
        variant="h5"
        sx={{
          flex: 1,
          minWidth: 0,
          mb: 0,
          background:
            "linear-gradient(102deg, #ffffff 0%, #d4c4f0 22%, #b19cd9 38%, #ff1493 58%, #7ee8ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter:
            "drop-shadow(0 0 18px rgba(255, 20, 147, 0.45)) drop-shadow(0 0 28px rgba(177, 156, 217, 0.25))",
        }}
      >
        Wii Memcard Manager
      </Typography>
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent={{ xs: "stretch", sm: "flex-end" }}
        sx={{ flexShrink: 0 }}
      >
        <Tooltip title="SD copy & pipeline (Mac)">
          <IconButton
            color="inherit"
            size="large"
            onClick={onOpenPipelineSettings}
            aria-label="Open background pipeline settings"
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={importButtonTooltip}
          disableHoverListener={!importButtonTooltip}
        >
          <Box
            component="span"
            sx={{ flex: { xs: 1, sm: "none" }, minWidth: 0 }}
          >
            <Button
              fullWidth={isXs}
              size="large"
              variant="contained"
              color="primary"
              onClick={onImport}
              disabled={importDisabled}
              sx={{
                py: 1.25,
                px: 2.5,
                fontSize: "1.05rem",
                fontWeight: 700,
                minWidth: { sm: 220 },
              }}
            >
              {pendingChangeCount > 0
                ? `Apply ${pendingChangeCount} change${pendingChangeCount === 1 ? "" : "s"} to .raw`
                : "Apply to .raw"}
            </Button>
          </Box>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
