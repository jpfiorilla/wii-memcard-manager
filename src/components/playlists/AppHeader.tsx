import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";

/** Title, which playlist the Wii gets, and the settings button. */
export function AppHeader({ activeName, onOpenSettings }: { activeName: string | null; onOpenSettings: () => void }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
      <Typography
        variant="h5"
        component="h1"
        sx={{
          flex: "1 1 auto",
          minWidth: 0,
          background:
            "linear-gradient(102deg, #ffffff 0%, #d4c4f0 22%, #b19cd9 38%, #ff1493 58%, #7ee8ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 0 18px rgba(255, 20, 147, 0.45)) drop-shadow(0 0 28px rgba(177, 156, 217, 0.25))",
        }}
      >
        Wii Memcard Manager
      </Typography>
      {activeName && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            px: 2,
            py: 1,
            borderRadius: 999,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "rgba(177, 156, 217, 0.06)",
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "info.main" }} />
          <Typography variant="body2" color="text.secondary">
            Wii gets
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {activeName}
          </Typography>
        </Box>
      )}
      <Tooltip title="Settings">
        <IconButton color="inherit" size="large" onClick={onOpenSettings} aria-label="Settings">
          <SettingsIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
