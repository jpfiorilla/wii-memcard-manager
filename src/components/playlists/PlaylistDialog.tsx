import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { CustomPlaylist, PlaylistView } from "./types";
import { CharacterIcon, characterLabel } from "@/components/memcard/CharacterIcon";

type PlaylistDialogProps = {
  open: boolean;
  /** Editing an existing playlist; null makes a new one. */
  editing: CustomPlaylist | null;
  view: PlaylistView;
  onClose: () => void;
  onSave: (p: Omit<CustomPlaylist, "id"> & { id?: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
};

export function PlaylistDialog({ open, editing, view, onClose, onSave, onDelete }: PlaylistDialogProps) {
  const [name, setName] = useState("");
  const [matchups, setMatchups] = useState<number[]>([]);
  const [order, setOrder] = useState<CustomPlaylist["order"]>("newest");
  const [count, setCount] = useState(String(view.cap));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setMatchups(editing?.matchups ?? []);
    setOrder(editing?.order ?? "newest");
    setCount(String(editing?.count ?? view.cap));
  }, [open, editing, view.cap]);

  // Characters you have recordings against, most first; plus any already picked.
  const choices = useMemo(() => {
    const present = view.playlists.filter((p) => p.group === "matchup").map((p) => p.opponent!);
    return [...present, ...matchups.filter((m) => !present.includes(m))];
  }, [view.playlists, matchups]);

  const available = useMemo(() => {
    if (matchups.length === 0) return view.recordingCount;
    return view.playlists
      .filter((p) => p.group === "matchup" && matchups.includes(p.opponent!))
      .reduce((n, p) => n + p.available, 0);
  }, [view, matchups]);

  const n = Number(count);
  const countValid = Number.isInteger(n) && n >= 1 && n <= view.cap;
  const onCard = Math.min(available, countValid ? n : view.cap);
  const canSave = name.trim().length > 0 && countValid && !saving;

  const toggle = (ckind: number) =>
    setMatchups((m) => (m.includes(ckind) ? m.filter((x) => x !== ckind) : [...m, ckind]));

  const save = async () => {
    setSaving(true);
    try {
      const ok = await onSave({ id: editing?.id, name: name.trim(), matchups, order, count: n });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="playlist-dialog-title">
      <DialogTitle id="playlist-dialog-title">{editing ? "Edit playlist" : "New playlist"}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          inputProps={{ maxLength: 40 }}
          placeholder="Spacies"
        />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Matchup{" "}
            <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
              · any if none picked
            </Box>
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {choices.map((ckind) => {
              const on = matchups.includes(ckind);
              return (
                <Chip
                  key={ckind}
                  icon={<CharacterIcon ckind={ckind} size={18} />}
                  label={characterLabel(ckind) ?? ckind}
                  onClick={() => toggle(ckind)}
                  color={on ? "primary" : "default"}
                  variant={on ? "filled" : "outlined"}
                  aria-pressed={on}
                  sx={{ pl: 0.5 }}
                />
              );
            })}
            {choices.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No recordings with a readable matchup yet.
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, alignItems: "flex-start" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }} id="playlist-order-label">
              Order
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={order}
              onChange={(_, v) => v && setOrder(v)}
              aria-labelledby="playlist-order-label"
            >
              <ToggleButton value="newest">Newest first</ToggleButton>
              <ToggleButton value="shuffle">Shuffle each sync</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <TextField
            label="How many"
            type="number"
            size="small"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            error={!countValid}
            helperText={`Card fits ${view.cap}`}
            inputProps={{ min: 1, max: view.cap }}
            sx={{ width: 140 }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary">
          {available} recording{available === 1 ? "" : "s"} match.{" "}
          {available > onCard
            ? order === "shuffle"
              ? `A random ${onCard} go on the card.`
              : `The newest ${onCard} go on the card.`
            : available > 0
              ? "All of them go on the card."
              : ""}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ gap: 1 }}>
        {editing && (
          <Button
            color="error"
            onClick={() => void onDelete(editing.id).then(onClose)}
            sx={{ mr: "auto" }}
          >
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={!canSave}>
          Save playlist
        </Button>
      </DialogActions>
    </Dialog>
  );
}
