import { Box, Stack, useMediaQuery } from "@mui/material";
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
  const isSourceTargetStacked = useMediaQuery(theme.breakpoints.down(400));
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

      <SourceTargetPipeline
        isNarrow={isSourceTargetStacked}
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
        sx={{
          gap: 2,
          flexDirection: "column",
          alignItems: "stretch",
          [theme.breakpoints.up(400)]: {
            flexDirection: "row",
          },
        }}
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

    </Box>
  );
}
