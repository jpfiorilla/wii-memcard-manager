import {
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
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
  return (
    <Paper
      sx={{
        p: 2,
        width: { xs: "100%", lg: 360 },
        flexShrink: 0,
        position: { lg: "sticky" },
        top: { lg: 88 },
        alignSelf: { lg: "flex-start" },
      }}
    >
      <Typography variant="subtitle1" gutterBottom>
        Pending changes
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 1.5 }}
      >
        Hardware limit: 127 saves per card (directory). A typical 2&nbsp;MB
        Nintendont image also has 251 user blocks (8&nbsp;KiB each) for all
        save data—imports fail when the card runs out of save slots or blocks.
      </Typography>
      {cardStats && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mb: 1.5 }}
        >
          Current card: {cardStats.directoryFileCount} save(s),{" "}
          {cardStats.freeBlocks} block(s) free.
        </Typography>
      )}
      {pendingChangeCount === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {candidates.length === 0
            ? "Nothing to show yet."
            : "No difference from the target .raw — adjust checkboxes to add or remove saves, then apply."}
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
                {pendingRemoveCount === 1 ? "" : "s"} from .raw
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
          {checkedOnCardSummary.length} save
          {checkedOnCardSummary.length === 1 ? "" : "s"} already match the
          target (checked, no change).
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 1 }}
      >
        Before writing, the current <code>.raw</code> is copied under{" "}
        <code>backups/</code> next to it.
      </Typography>

      {!watching && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mb: 1 }}
        >
          Enable <strong>Watch</strong> on the source to stream folder events
          below (sync / exports).
        </Typography>
      )}

      {watching && (
        <>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
            Folder activity
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mb: 1 }}
          >
            File events rescans the list (debounced). Useful when Drive sync
            drops new <code>.gci</code> files in.
          </Typography>
          {events.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No events yet — add/delete a file in the folder to see activity.
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
