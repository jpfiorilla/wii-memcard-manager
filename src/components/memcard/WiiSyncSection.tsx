import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import type { WiiSyncStatus } from "@/vite-env";

/** Read-only status of the server the Wii's TM Sync app pulls the card from. */
export function WiiSyncSection() {
  const [status, setStatus] = useState<WiiSyncStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => void window.memcard.getWiiSyncStatus().then((s) => alive && setStatus(s));
    refresh();
    const off = window.memcard.onWiiSyncStatus((s) => setStatus(s));
    const offDelivered = window.memcard.onWiiSyncDelivered(refresh);
    return () => {
      alive = false;
      off();
      offDelivered();
    };
  }, []);

  const last = status?.lastRequest;
  const line = !status
    ? "…"
    : status.error
      ? `Not running: ${status.error}`
      : status.running
        ? `Ready for the Wii at ${status.addresses[0] ?? "this Mac"}`
        : "Off";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Typography variant="subtitle2">Wii sync</Typography>
      <Typography variant="body2" color={status?.error ? "error" : "text.secondary"}>
        {line}
      </Typography>
      {last && (
        <Typography variant="caption" color="text.secondary">
          Last pull {new Date(last.at).toLocaleTimeString()}:{" "}
          {last.status === 304 ? "already up to date" : last.status === 200 ? "sent new card" : last.status}
        </Typography>
      )}
    </Box>
  );
}
