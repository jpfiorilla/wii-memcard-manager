import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { PlaylistSummary } from "@/vite-env";
import { CharacterIcon } from "@/components/memcard/CharacterIcon";

type PlaylistTileProps = {
  playlist: PlaylistSummary;
  selected: boolean;
  onSelect: () => void;
  /** Yours: opens the playlist for editing. */
  onEdit?: () => void;
};

export function PlaylistTile({ playlist: p, selected, onSelect, onEdit }: PlaylistTileProps) {
  const isMatchup = p.group === "matchup" && p.opponent !== undefined;
  return (
    <Box sx={{ position: "relative", minWidth: 0 }}>
      <ButtonBase
        onClick={onSelect}
        aria-pressed={selected}
        sx={(t) => ({
          width: "100%",
          minHeight: isMatchup ? 60 : 76,
          p: 1.5,
          pr: onEdit ? 5 : 1.5,
          borderRadius: 1.5,
          display: "flex",
          flexDirection: isMatchup ? "row" : "column",
          alignItems: isMatchup ? "center" : "flex-start",
          justifyContent: isMatchup ? "flex-start" : "center",
          gap: isMatchup ? 1.25 : 0.5,
          textAlign: "left",
          border: "1px solid",
          borderColor: selected ? "primary.main" : "divider",
          boxShadow: selected ? `inset 0 0 0 1px ${t.palette.primary.main}` : "none",
          bgcolor: selected ? "rgba(255, 20, 147, 0.12)" : "rgba(255, 255, 255, 0.03)",
          transition: t.transitions.create(["background-color", "border-color"], {
            duration: t.transitions.duration.shortest,
          }),
          "&:hover": { bgcolor: selected ? "rgba(255, 20, 147, 0.16)" : "rgba(255, 255, 255, 0.06)" },
          "&.Mui-focusVisible": { outline: `2px solid ${t.palette.info.main}`, outlineOffset: 2 },
        })}
      >
        {isMatchup && <CharacterIcon ckind={p.opponent!} size={32} />}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0, maxWidth: "100%" }}>
          <Typography sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }} noWrap>
            {p.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {p.description}
          </Typography>
        </Box>
      </ButtonBase>
      {onEdit && (
        <IconButton
          size="small"
          aria-label={`Edit ${p.name}`}
          onClick={onEdit}
          sx={{ position: "absolute", top: 6, right: 6, color: "text.secondary" }}
        >
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}
