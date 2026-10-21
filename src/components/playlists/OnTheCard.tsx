import { Box, Paper, Typography } from "@mui/material";
import SdCardOutlinedIcon from "@mui/icons-material/SdCardOutlined";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import type { PlaylistView } from "./types";
import { CharacterIcon } from "@/components/memcard/CharacterIcon";

/** What the active playlist puts on the card, in card order. */
export function OnTheCard({ view }: { view: PlaylistView }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, px: 0.5 }}>
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 600, flexGrow: 1 }}>
          On the card
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {view.card.length} of {view.cap} slots
        </Typography>
      </Box>

      {view.shuffles && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5, color: "text.secondary" }}>
          <ShuffleIcon fontSize="small" />
          <Typography variant="body2">A new mix after every Wii sync.</Typography>
        </Box>
      )}

      {view.gameSaves > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 1, borderRadius: 1, bgcolor: "rgba(177, 156, 217, 0.08)" }}>
          <SdCardOutlinedIcon fontSize="small" sx={{ color: "info.main" }} />
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            TM:CE game save
          </Typography>
          <Typography variant="body2" color="text.secondary">
            always included
          </Typography>
        </Box>
      )}

      <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0.25, overflowY: "auto", minHeight: 0 }}>
        {view.card.map((r, i) => (
          <Box
            component="li"
            key={r.path}
            title={r.path}
            sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.25, minHeight: 28, borderRadius: 1, "&:hover": { bgcolor: "rgba(255, 255, 255, 0.04)" } }}
          >
            <Typography component="span" sx={{ width: 20, textAlign: "right", fontSize: 11, fontFamily: "monospace", color: "text.secondary", flexShrink: 0 }}>
              {i + 1}
            </Typography>
            {r.opponent !== null ? <CharacterIcon ckind={r.opponent} size={20} /> : <Box sx={{ width: 20, flexShrink: 0 }} />}
            <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
              {r.name}
            </Typography>
          </Box>
        ))}
      </Box>
      {view.card.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          Nothing matches this playlist yet.
        </Typography>
      )}
    </Paper>
  );
}
