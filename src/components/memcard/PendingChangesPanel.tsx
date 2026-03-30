import {
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { CardScanStats, GciFolderEntry } from "@/types/memcard";

type PendingChangesPanelProps = {
  cardStats: CardScanStats | null;
  candidates: GciFolderEntry[];
  pendingChangeCount: number;
  pendingAddCount: number;
  pendingRemoveCount: number;
  selectedForSummary: GciFolderEntry[];
  pendingRemovalSummary: GciFolderEntry[];
  checkedOnCardSummary: GciFolderEntry[];
  watching: boolean;
  events: string[];
};

export function PendingChangesPanel({
  cardStats,
  candidates,
  pendingChangeCount,
  pendingAddCount,
  pendingRemoveCount,
  selectedForSummary,
  pendingRemovalSummary,
  checkedOnCardSummary,
  watching,
  events,
}: PendingChangesPanelProps) {
  const theme = useTheme();
  return (
    <Paper
      sx={{
        p: 2,
        width: "100%",
        flexShrink: 0,
        [theme.breakpoints.up(400)]: {
          width: 360,
          maxWidth: "100%",
          position: "sticky",
          top: 88,
        },
      }}
    >
      <Typography variant="subtitle1" gutterBottom>
        What will change
      </Typography>
      {cardStats && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mb: 1.5 }}
        >
          {cardStats.directoryFileCount} save
          {cardStats.directoryFileCount === 1 ? "" : "s"} on card ·{" "}
          {cardStats.freeBlocks} blocks free
        </Typography>
      )}
      {pendingChangeCount === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {candidates.length === 0
            ? "Nothing yet."
            : "No changes — toggle some saves."}
        </Typography>
      ) : (
        <>
          {pendingAddCount > 0 && (
            <>
              <Typography variant="h6" color="primary.light" sx={{ mb: 1 }}>
                Add {pendingAddCount} save{pendingAddCount === 1 ? "" : "s"}
              </Typography>
              <List
                dense
                disablePadding
                sx={{ maxHeight: 220, overflow: "auto" }}
              >
                {selectedForSummary.slice(0, 12).map((c) => (
                  <ListItem
                    key={c.path}
                    disableGutters
                    sx={{ py: 0.25, display: "block" }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ wordBreak: "break-all" }}
                    >
                      {c.fileName}
                    </Typography>
                  </ListItem>
                ))}
              </List>
              {selectedForSummary.length > 12 && (
                <Typography variant="caption" color="text.secondary">
                  +{selectedForSummary.length - 12} more
                </Typography>
              )}
            </>
          )}
          {pendingRemoveCount > 0 && (
            <>
              <Typography
                variant="h6"
                color="warning.main"
                sx={{ mb: 1, ...(pendingAddCount > 0 ? { mt: 2 } : {}) }}
              >
                Remove {pendingRemoveCount} save
                {pendingRemoveCount === 1 ? "" : "s"}
              </Typography>
              <List
                dense
                disablePadding
                sx={{ maxHeight: 160, overflow: "auto" }}
              >
                {pendingRemovalSummary.slice(0, 12).map((c) => (
                  <ListItem
                    key={c.path}
                    disableGutters
                    sx={{ py: 0.25, display: "block" }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ wordBreak: "break-all" }}
                    >
                      {c.fileName}
                    </Typography>
                  </ListItem>
                ))}
              </List>
              {pendingRemovalSummary.length > 12 && (
                <Typography variant="caption" color="text.secondary">
                  +{pendingRemovalSummary.length - 12} more
                </Typography>
              )}
            </>
          )}
        </>
      )}
      {pendingChangeCount === 0 && checkedOnCardSummary.length > 0 && (
        <Typography
          variant="caption"
          color="success.main"
          display="block"
          sx={{ mt: 1.5 }}
        >
          All set — no edits needed.
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 1 }}
      >
        Old card is copied to <code>backups/</code> before each apply.
      </Typography>

      {!watching && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mb: 1 }}
        >
          Use <strong>Watch</strong> to see file activity below.
        </Typography>
      )}

      {watching && (
        <>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
            Folder activity
          </Typography>
          {events.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Waiting for file changes…
            </Typography>
          ) : (
            <List
              dense
              disablePadding
              sx={{ maxHeight: 160, overflow: "auto" }}
            >
              {events.slice(0, 8).map((line, i) => (
                <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primaryTypographyProps={{
                      variant: "caption",
                      sx: {
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "0.72rem",
                        color: "rgba(212, 196, 240, 0.88)",
                        wordBreak: "break-all",
                      },
                    }}
                    primary={line}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}
    </Paper>
  );
}
