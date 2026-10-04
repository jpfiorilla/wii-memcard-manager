import { useEffect, useState } from "react";
import {
  Box,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { WiiSyncStatus } from "@/vite-env";
import type { PipelineSettingsState } from "@/types/memcard";

type Props = {
  pipeline: PipelineSettingsState;
  updatePipeline: (partial: Partial<PipelineSettingsState>) => Promise<void>;
};

/** Settings + live status for the LAN server the Wii "TM Sync" app pulls saves from. */
export function WiiSyncSection({ pipeline, updatePipeline }: Props) {
  const [status, setStatus] = useState<WiiSyncStatus | null>(null);
  const [portDraft, setPortDraft] = useState(String(pipeline.wiiSyncPort));

  useEffect(() => setPortDraft(String(pipeline.wiiSyncPort)), [pipeline.wiiSyncPort]);

  useEffect(() => {
    let alive = true;
    void window.memcard.getWiiSyncStatus().then((s) => alive && setStatus(s));
    const off = window.memcard.onWiiSyncStatus((s) => setStatus(s));
    const offDelivered = window.memcard.onWiiSyncDelivered(() => {
      void window.memcard.getWiiSyncStatus().then((s) => alive && setStatus(s));
    });
    return () => {
      alive = false;
      off();
      offDelivered();
    };
  }, []);

  const host = status?.addresses[0] ?? "<this Mac's IP>";
  const last = status?.lastRequest;

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Wii TM Sync (Wi-Fi)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        The <code>tm-sync</code> Homebrew Channel app asks this Mac for the newest staged{" "}
        <code>GTME.raw</code> before it boots Slippi Nintendont. It only downloads when the
        card&apos;s checksum changed since its last pull.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={pipeline.wiiSyncEnabled}
            onChange={(_, v) => void updatePipeline({ wiiSyncEnabled: v })}
            size="small"
          />
        }
        label="Serve staged images to the Wii"
      />
      <TextField
        label="Port"
        type="number"
        size="small"
        sx={{ maxWidth: 140, ml: 2 }}
        value={portDraft}
        onChange={(e) => setPortDraft(e.target.value)}
        onBlur={() => {
          const n = Number(portDraft);
          if (Number.isInteger(n) && n >= 1024 && n <= 65535) void updatePipeline({ wiiSyncPort: n });
          else setPortDraft(String(pipeline.wiiSyncPort));
        }}
      />
      <Typography
        variant="caption"
        color={status?.error ? "error" : "text.secondary"}
        sx={{ display: "block", mt: 1 }}
      >
        {!status
          ? "…"
          : status.error
            ? `Not running: ${status.error}`
            : status.running
              ? `Listening on ${status.addresses.join(", ") || "localhost"} : ${status.port}` +
                (status.discovery ? " (auto-discovery on)" : " (auto-discovery unavailable — set host= on the Wii)")
              : "Off"}
      </Typography>
      {last && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          Last Wii request: {last.fileName} → {last.status === 304 ? "already up to date" : last.status}{" "}
          at {new Date(last.at).toLocaleTimeString()}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Optional fixed address for <code>sd:/apps/tm-sync/config.ini</code>:{" "}
        <code>
          host={host} port={pipeline.wiiSyncPort}
        </code>
      </Typography>
    </Box>
  );
}
