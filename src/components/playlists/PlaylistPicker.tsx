import { Box, ButtonBase, Checkbox, FormControlLabel, Link, Paper, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { PlaylistGroupName, PlaylistSummary, PlaylistView } from "./types";
import { PlaylistTile } from "./PlaylistTile";

type PlaylistPickerProps = {
  view: PlaylistView;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (p: PlaylistSummary) => void;
  onIncludeArchive: (v: boolean) => void;
  onChangeFolder: () => void;
};

const SECTIONS: { group: PlaylistGroupName; title: string; minTile: number }[] = [
  { group: "recent", title: "Recent", minTile: 180 },
  { group: "matchup", title: "Matchup", minTile: 150 },
  { group: "yours", title: "Yours", minTile: 200 },
];

function lastSegment(p: string) {
  const s = p.replace(/[/\\]+$/, "");
  return s.slice(Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\")) + 1);
}

export function PlaylistPicker({ view, onSelect, onNew, onEdit, onIncludeArchive, onChangeFolder }: PlaylistPickerProps) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3, border: "1px solid", borderColor: "divider", minWidth: 0 }}
    >
      {SECTIONS.map(({ group, title, minTile }) => {
        const items = view.playlists.filter((p) => p.group === group);
        if (group === "matchup" && items.length === 0) return null;
        return (
          <Box key={group} component="section" sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <Typography
              component="h2"
              variant="overline"
              color="text.secondary"
              sx={{ fontWeight: 600, letterSpacing: "0.12em", lineHeight: 1.5 }}
            >
              {title}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${minTile}px, 1fr))`, gap: 1.25 }}>
              {items.map((p) => (
                <PlaylistTile
                  key={p.id}
                  playlist={p}
                  selected={p.id === view.active}
                  onSelect={() => onSelect(p.id)}
                  onEdit={group === "yours" ? () => onEdit(p) : undefined}
                />
              ))}
              {group === "yours" && (
                <ButtonBase
                  onClick={onNew}
                  sx={(t) => ({
                    minHeight: 76,
                    borderRadius: 1.5,
                    border: "1px dashed",
                    borderColor: "secondary.dark",
                    color: "text.secondary",
                    display: "flex",
                    gap: 1,
                    fontSize: 14,
                    fontWeight: 500,
                    "&:hover": { bgcolor: "rgba(255, 255, 255, 0.04)", color: "text.primary" },
                    "&.Mui-focusVisible": { outline: `2px solid ${t.palette.info.main}`, outlineOffset: 2 },
                  })}
                >
                  <AddIcon fontSize="small" />
                  New playlist
                </ButtonBase>
              )}
            </Box>
          </Box>
        );
      })}

      <Box
        sx={{
          mt: "auto",
          pt: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flex: "1 1 260px", minWidth: 0 }} title={view.folder ?? ""}>
          From{" "}
          <Box component="span" sx={{ color: "text.primary", fontWeight: 500 }}>
            {view.folder ? lastSegment(view.folder) : "—"}
          </Box>{" "}
          · {view.recordingCount} recordings ·{" "}
          <Link component="button" variant="body2" onClick={onChangeFolder} sx={{ verticalAlign: "baseline" }}>
            Change folder
          </Link>
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={view.includeArchive}
              onChange={(_, v) => onIncludeArchive(v)}
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Include archive{view.archiveCount ? ` (${view.archiveCount})` : ""}
            </Typography>
          }
          sx={{ mr: 0 }}
        />
      </Box>
    </Paper>
  );
}
