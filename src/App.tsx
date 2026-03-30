import { Box, Chip, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMemcardWorkspace } from "@/hooks/useMemcardWorkspace";
import { GciCandidateList } from "@/components/memcard/GciCandidateList";
import { MemcardAppHeader } from "@/components/memcard/MemcardAppHeader";
import { PendingChangesPanel } from "@/components/memcard/PendingChangesPanel";
import { PipelineSettingsDialog } from "@/components/memcard/PipelineSettingsDialog";
import { ScanToolbar } from "@/components/memcard/ScanToolbar";
import { SourceTargetPipeline } from "@/components/memcard/SourceTargetPipeline";

export default function App() {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const w = useMemcardWorkspace();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        p: { xs: 2, sm: 3 },
        pb: 10,
      }}
    >
      <MemcardAppHeader
        isXs={isXs}
        importButtonTooltip={w.importButtonTooltip}
        importDisabled={w.importDisabled}
        pendingChangeCount={w.pendingChangeCount}
        onOpenPipelineSettings={() => w.setPipelineSettingsOpen(true)}
        onImport={() => void w.importSelected()}
      />

      <PipelineSettingsDialog
        open={w.pipelineSettingsOpen}
        onClose={() => w.setPipelineSettingsOpen(false)}
        pipeline={w.pipeline}
        setPipeline={w.setPipeline}
        onPickStagingDir={w.pickStagingDir}
        updatePipeline={w.updatePipeline}
      />

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, maxWidth: 720 }}
      >
        Add or remove saves on your Nintendont <code>.raw</code> using the
        checklist (checked = desired state on the card). Choosing a GCI folder
        starts <strong>watching</strong> it; new <code>.gci</code> files can be
        batched into staging images and copied to the SD when you plug it in
        (macOS). Before each apply, the current card file is copied to{" "}
        <code>backups/</code> beside it.
      </Typography>

      <SourceTargetPipeline
        isNarrow={isNarrow}
        gciFolder={w.gciFolder}
        rawPath={w.rawPath}
        watching={w.watching}
        onPickGciFolder={() => void w.pickGciFolder()}
        onToggleWatch={() => void w.toggleWatch()}
        onPickRaw={() => void w.pickRaw()}
        onTestBackup={() => void w.testBackup()}
      />

      <ScanToolbar
        gciFolder={w.gciFolder}
        rawPath={w.rawPath}
        scanning={w.scanning}
        hasImportable={w.hasImportable}
        cardStats={w.cardStats}
        onRescan={w.runScan}
        onSelectAllImportable={w.selectAllImportable}
      />

      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        alignItems="flex-start"
      >
        <GciCandidateList
          candidates={w.candidates}
          selectedPaths={w.selectedPaths}
          scanning={w.scanning}
          gciFolder={w.gciFolder}
          rawPath={w.rawPath}
          onTogglePath={w.togglePath}
        />

        <PendingChangesPanel
          cardStats={w.cardStats}
          candidates={w.candidates}
          pendingChangeCount={w.pendingChangeCount}
          pendingAddCount={w.pendingAddCount}
          pendingRemoveCount={w.pendingRemoveCount}
          selectedForSummary={w.selectedForSummary}
          pendingRemovalSummary={w.pendingRemovalSummary}
          checkedOnCardSummary={w.checkedOnCardSummary}
          watching={w.watching}
          events={w.events}
        />
      </Stack>

      <Box sx={{ mt: 3 }}>
        <Chip
          size="small"
          label="TM:CE → GTME.raw"
          variant="outlined"
          sx={{ mr: 1 }}
        />
        <Chip size="small" label="Vanilla US → GALE.raw" variant="outlined" />
      </Box>
    </Box>
  );
}
