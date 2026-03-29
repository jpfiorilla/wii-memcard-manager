import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormGroup,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Tooltip,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { useSnackbar } from 'notistack'
import { MAX_CARD_DIRECTORY_FILES } from './constants/card'

type GciFolderEntry = {
  path: string
  fileName: string
  saveName: string
  alreadyOnCard: boolean
  parseError: string | null
  blockCount: number
  mtimeMs: number
}

type CardScanStats = {
  directoryFileCount: number
  freeBlocks: number
}

export default function App() {
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const { enqueueSnackbar } = useSnackbar()
  const [gciFolder, setGciFolder] = useState<string | null>(null)
  const [rawPath, setRawPath] = useState<string | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const [watching, setWatching] = useState(false)

  const [candidates, setCandidates] = useState<GciFolderEntry[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [cardStats, setCardStats] = useState<CardScanStats | null>(null)
  const [scanning, setScanning] = useState(false)
  /** Paths that were importable on the previous successful scan (game+filename not on card, parse ok). */
  const lastImportableRef = useRef<Set<string>>(new Set())
  /** Every .gci path seen on the previous successful scan (any status). */
  const previousPathsRef = useRef<Set<string>>(new Set())
  const scanDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    lastImportableRef.current = new Set()
    previousPathsRef.current = new Set()
  }, [gciFolder, rawPath])

  const runScan = useCallback(async () => {
    if (!rawPath || !gciFolder) {
      setCandidates([])
      setSelectedPaths(new Set())
      setCardStats(null)
      lastImportableRef.current = new Set()
      previousPathsRef.current = new Set()
      return
    }
    setScanning(true)
    try {
      const r = await window.memcard.scanGciFolder({ rawPath, gciFolder })
      if (!r.ok) {
        setCandidates([])
        setCardStats(null)
        enqueueSnackbar(r.error, { variant: 'error' })
        return
      }
      setCandidates(r.entries)
      setCardStats(r.cardStats)
      setSelectedPaths((prev) => {
        const importable = new Set(
          r.entries.filter((e) => !e.parseError && !e.alreadyOnCard).map((e) => e.path),
        )
        const next = new Set<string>()
        const prevImp = lastImportableRef.current
        const prevPaths = previousPathsRef.current
        for (const p of importable) {
          const brandNewInFolder = !prevPaths.has(p)
          const newlyImportable = !prevImp.has(p)
          if (brandNewInFolder || newlyImportable) {
            next.add(p)
          } else if (prev.has(p)) {
            next.add(p)
          }
        }
        lastImportableRef.current = importable
        previousPathsRef.current = new Set(r.entries.map((e) => e.path))
        return next
      })
    } finally {
      setScanning(false)
    }
  }, [rawPath, gciFolder, enqueueSnackbar])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const s = await window.memcard.getUserSettings()
      if (cancelled) return
      if (s.gciFolder) setGciFolder(s.gciFolder)
      if (s.rawPath) setRawPath(s.rawPath)
      if (s.gciFolder && s.folderWatchEnabled) {
        const r = await window.memcard.startWatch(s.gciFolder)
        if (!cancelled && r?.ok) setWatching(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    window.ipcRenderer.on('main-process-message', (_e, msg) => {
      console.log('[main]', msg)
    })
  }, [])

  useEffect(() => {
    void runScan()
  }, [runScan])

  useEffect(() => {
    if (!gciFolder) return () => undefined
    const unsub = window.memcard.onFolderChanged((ev) => {
      const line = `${ev.eventKind} ${ev.filePath}`
      setEvents((prev) => [line, ...prev].slice(0, 40))
      if (ev.rootDir !== gciFolder || !rawPath) return
      if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current)
      scanDebounceRef.current = setTimeout(() => {
        scanDebounceRef.current = null
        void runScan()
      }, 500)
    })
    return () => {
      unsub()
      if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current)
    }
  }, [gciFolder, rawPath, runScan])

  const pickGciFolder = async () => {
    const p = await window.memcard.pickDirectory(gciFolder)
    if (!p) return
    if (watching && gciFolder) {
      await window.memcard.stopWatch(gciFolder)
      setWatching(false)
    }
    setGciFolder(p)
    await window.memcard.mergeUserSettings({ gciFolder: p, folderWatchEnabled: false })
    enqueueSnackbar(`GCI folder: ${p}`, { variant: 'success' })
  }

  const pickRaw = async () => {
    const p = await window.memcard.pickFile()
    if (!p) return
    setRawPath(p)
    await window.memcard.mergeUserSettings({ rawPath: p })
    enqueueSnackbar(`Output .raw: ${p}`, { variant: 'success' })
  }

  const togglePath = (path: string, checked: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (checked) next.add(path)
      else next.delete(path)
      return next
    })
  }

  const importSelected = async () => {
    if (!rawPath || !gciFolder) {
      enqueueSnackbar('Choose a GCI folder and target .raw first', { variant: 'warning' })
      return
    }
    const paths = candidates
      .filter((c) => selectedPaths.has(c.path) && !c.alreadyOnCard && !c.parseError)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .map((c) => c.path)
    if (paths.length === 0) {
      enqueueSnackbar('Select at least one new save to import', { variant: 'warning' })
      return
    }
    const res = await window.memcard.importGcis(rawPath, paths)
    if (res.ok) {
      enqueueSnackbar(`Imported ${paths.length} save(s) into memory card`, { variant: 'success' })
      await runScan()
    } else {
      enqueueSnackbar(res.error, { variant: 'error' })
    }
  }

  const toggleWatch = async () => {
    if (!gciFolder) {
      enqueueSnackbar('Pick a GCI folder first', { variant: 'warning' })
      return
    }
    if (watching) {
      await window.memcard.stopWatch(gciFolder)
      setWatching(false)
      await window.memcard.mergeUserSettings({ folderWatchEnabled: false })
      enqueueSnackbar('Stopped watching', { variant: 'default' })
    } else {
      const r = await window.memcard.startWatch(gciFolder)
      if (r?.ok) {
        setWatching(true)
        await window.memcard.mergeUserSettings({ folderWatchEnabled: true })
        enqueueSnackbar('Watching for changes', { variant: 'success' })
      } else {
        enqueueSnackbar('Could not start watch', { variant: 'error' })
      }
    }
  }

  const testBackup = async () => {
    if (!rawPath) {
      enqueueSnackbar('Pick a .raw file first', { variant: 'warning' })
      return
    }
    const res = await window.memcard.backupBeforeWrite(rawPath)
    if ('skipped' in res && res.skipped) {
      enqueueSnackbar('No existing file to back up', { variant: 'info' })
    } else if ('ok' in res && res.ok === true && 'backupPath' in res) {
      enqueueSnackbar(`Backup → ${res.backupPath}`, { variant: 'success' })
    } else if ('ok' in res && res.ok === false && 'error' in res) {
      enqueueSnackbar(res.error, { variant: 'error' })
    }
  }

  const selectedImportCount = candidates.filter(
    (c) => selectedPaths.has(c.path) && !c.alreadyOnCard && !c.parseError,
  ).length

  const selectedForSummary = candidates.filter(
    (c) => selectedPaths.has(c.path) && !c.alreadyOnCard && !c.parseError,
  )

  const hasImportable = candidates.some((c) => !c.parseError && !c.alreadyOnCard)

  const selectionInvalidReason = useMemo(() => {
    if (!cardStats) return null
    const picked = candidates.filter(
      (c) => selectedPaths.has(c.path) && !c.parseError && !c.alreadyOnCard,
    )
    if (picked.length === 0) return null
    const slots = picked.length
    const blocks = picked.reduce((s, c) => s + c.blockCount, 0)
    const slotsLeft = MAX_CARD_DIRECTORY_FILES - cardStats.directoryFileCount
    if (slots > slotsLeft) {
      return `This selection needs ${slots} new save slot(s), but only ${slotsLeft} slot(s) remain (${MAX_CARD_DIRECTORY_FILES} max on the card).`
    }
    if (blocks > cardStats.freeBlocks) {
      return `This selection needs ${blocks} blocks of free space, but only ${cardStats.freeBlocks} block(s) are free.`
    }
    return null
  }, [cardStats, candidates, selectedPaths])

  const selectAllImportable = () => {
    if (!cardStats) return
    const next = new Set<string>()
    let usedSlots = 0
    let usedBlocks = 0
    const { directoryFileCount: dirCount, freeBlocks } = cardStats
    for (const c of candidates) {
      if (c.parseError || c.alreadyOnCard) continue
      if (dirCount + usedSlots + 1 > MAX_CARD_DIRECTORY_FILES) break
      if (usedBlocks + c.blockCount > freeBlocks) break
      next.add(c.path)
      usedSlots += 1
      usedBlocks += c.blockCount
    }
    setSelectedPaths(next)
  }

  const importDisabled =
    !rawPath || !gciFolder || scanning || selectedImportCount === 0 || selectionInvalidReason != null

  const pipelineArrow = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 0, md: 1 },
        py: { xs: 1, md: 0 },
        color: 'secondary.light',
      }}
    >
      {isNarrow ? (
        <ArrowDownwardIcon sx={{ fontSize: 36, opacity: 0.85 }} />
      ) : (
        <ArrowForwardIcon sx={{ fontSize: 40, opacity: 0.9 }} />
      )}
    </Box>
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, sm: 3 }, pb: 10 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          background:
            'linear-gradient(102deg, #ffffff 0%, #d4c4f0 22%, #b19cd9 38%, #ff1493 58%, #7ee8ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 18px rgba(255, 20, 147, 0.45)) drop-shadow(0 0 28px rgba(177, 156, 217, 0.25))',
        }}
      >
        Wii Memcard Manager
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Add saves from a synced or export folder into your Nintendont <code>.raw</code>. Before each write, the
        current card file is copied to <code>backups/</code> beside it.
      </Typography>

      {/* Source → Target pipeline */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          background: 'linear-gradient(135deg, rgba(177, 156, 217, 0.08) 0%, rgba(255, 20, 147, 0.06) 100%)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={0}
          alignItems="stretch"
          sx={{ position: 'relative' }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              p: 2,
              borderRadius: 1,
              borderLeft: '4px solid',
              borderColor: 'secondary.main',
              bgcolor: 'rgba(177, 156, 217, 0.06)',
            }}
          >
            <Typography variant="overline" color="secondary.light" sx={{ letterSpacing: '0.12em' }}>
              Source
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 0.5, mb: 1 }}>
              .gci folder
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                startIcon={<FolderOpenIcon />}
                variant="contained"
                color="secondary"
                onClick={pickGciFolder}
              >
                Choose folder
              </Button>
              <Button size="small" variant="outlined" onClick={toggleWatch} disabled={!gciFolder}>
                {watching ? 'Stop watch' : 'Watch'}
              </Button>
            </Stack>
            {gciFolder ? (
              <Typography variant="body2" sx={{ mt: 1.5, wordBreak: 'break-all', opacity: 0.92 }}>
                {gciFolder}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Not set — choose where new <code>.gci</code> files land.
              </Typography>
            )}
          </Box>

          {pipelineArrow}

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              p: 2,
              borderRadius: 1,
              borderRight: { md: '4px solid' },
              borderBottom: { xs: '4px solid', md: 'none' },
              borderColor: 'primary.main',
              bgcolor: 'rgba(255, 20, 147, 0.05)',
            }}
          >
            <Typography variant="overline" color="primary.light" sx={{ letterSpacing: '0.12em' }}>
              Target
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 0.5, mb: 1 }}>
              Nintendont .raw
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" startIcon={<SaveIcon />} variant="outlined" color="primary" onClick={pickRaw}>
                Choose .raw
              </Button>
              <Button size="small" variant="text" onClick={testBackup} disabled={!rawPath}>
                Test backup
              </Button>
            </Stack>
            {rawPath ? (
              <Typography variant="body2" sx={{ mt: 1.5, wordBreak: 'break-all', opacity: 0.92 }}>
                {rawPath}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Not set — choose the card file to update.
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Stays visible while scrolling the checklist */}
      <Paper
        elevation={3}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          mb: 2,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'rgba(255, 20, 147, 0.35)',
          background: (t) =>
            `linear-gradient(180deg, ${t.palette.background.paper} 0%, rgba(13, 2, 33, 0.97) 100%)`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
          <Tooltip title={selectionInvalidReason ?? ''} disableHoverListener={!selectionInvalidReason}>
            <Box component="span" sx={{ flex: { sm: 1 }, width: '100%', display: 'inline-flex' }}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                color="primary"
                onClick={() => void importSelected()}
                disabled={importDisabled}
                sx={{ py: 1.5, fontSize: '1.05rem', fontWeight: 700 }}
              >
                {selectedImportCount > 0
                  ? `Import ${selectedImportCount} into .raw`
                  : 'Import into .raw'}
              </Button>
            </Box>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void runScan()}
            disabled={!gciFolder || !rawPath || scanning}
            sx={{ minWidth: { sm: 140 }, alignSelf: { xs: 'stretch', sm: 'center' } }}
          >
            Rescan
          </Button>
          <Tooltip title="Selects the newest importable files first (by modified time), stopping when the card runs out of save slots or free blocks.">
            <Box sx={{ display: 'flex', alignSelf: { xs: 'stretch', sm: 'center' } }}>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<SelectAllIcon />}
                onClick={selectAllImportable}
                disabled={!gciFolder || !rawPath || scanning || !hasImportable || !cardStats}
                sx={{ minWidth: { sm: 160 } }}
              >
                Select all importable
              </Button>
            </Box>
          </Tooltip>
        </Stack>
        {scanning && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Scanning folder…
            </Typography>
          </Box>
        )}
      </Paper>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
        <Paper
          sx={{
            p: 2,
            flex: 1,
            width: '100%',
            minWidth: 0,
            maxHeight: { lg: 'calc(100vh - 320px)' },
            overflow: 'auto',
          }}
        >
          <Typography variant="subtitle1" gutterBottom>
            Saves in folder
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1.5 }}>
            Newest files first (by modified time). New saves not yet on the card are checked by default; uncheck to
            skip.
          </Typography>

          {!scanning && gciFolder && rawPath && candidates.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No .gci files in this folder.
            </Typography>
          )}

          {!scanning && (!gciFolder || !rawPath) && (
            <Typography variant="body2" color="text.secondary">
              Set source and target above to list saves.
            </Typography>
          )}

          {candidates.length > 0 && (
            <FormGroup>
              {candidates.map((c) => {
                const canImport = !c.parseError && !c.alreadyOnCard
                const checked = canImport && selectedPaths.has(c.path)
                return (
                  <FormControlLabel
                    key={c.path}
                    control={
                      <Checkbox
                        checked={checked}
                        disabled={!canImport}
                        onChange={(_, v) => togglePath(c.path, v)}
                        size="small"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" component="span" sx={{ wordBreak: 'break-all' }}>
                          {c.saveName || c.fileName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {c.fileName}
                          {c.parseError && ` — ${c.parseError}`}
                          {c.alreadyOnCard && !c.parseError && ' — already on card'}
                        </Typography>
                      </Box>
                    }
                  />
                )
              })}
            </FormGroup>
          )}
        </Paper>

        <Paper
          sx={{
            p: 2,
            width: { xs: '100%', lg: 360 },
            flexShrink: 0,
            position: { lg: 'sticky' },
            top: { lg: 88 },
            alignSelf: { lg: 'flex-start' },
          }}
        >
          <Typography variant="subtitle1" gutterBottom>
            Import summary
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Hardware limit: 127 saves per card (directory). A typical 2&nbsp;MB Nintendont image also has 251 user
            blocks (8&nbsp;KiB each) for all save data—imports fail when the card runs out of save slots or blocks.
          </Typography>
          {cardStats && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              Current card: {cardStats.directoryFileCount} save(s), {cardStats.freeBlocks} block(s) free.
            </Typography>
          )}
          {selectedImportCount === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Select one or more saves in the list. The count and names of what will be written appear here.
            </Typography>
          ) : (
            <>
              <Typography variant="h6" color="primary.light" sx={{ mb: 1 }}>
                {selectedImportCount} save{selectedImportCount === 1 ? '' : 's'} staged
              </Typography>
              <List dense disablePadding sx={{ maxHeight: 220, overflow: 'auto' }}>
                {selectedForSummary.slice(0, 12).map((c) => (
                  <ListItem key={c.path} disableGutters sx={{ py: 0.25, display: 'block' }}>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {c.saveName || c.fileName}
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

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Before writing, the current <code>.raw</code> is copied under <code>backups/</code> next to it.
          </Typography>

          {!watching && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Enable <strong>Watch</strong> on the source to stream folder events below (sync / exports).
            </Typography>
          )}

          {watching && (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                Folder activity
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                File events rescans the list (debounced). Useful when Drive sync drops new <code>.gci</code> files in.
              </Typography>
              {events.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No events yet — add/delete a file in the folder to see activity.
                </Typography>
              ) : (
                <List dense disablePadding sx={{ maxHeight: 160, overflow: 'auto' }}>
                  {events.slice(0, 8).map((line, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                      <ListItemText
                        primaryTypographyProps={{
                          variant: 'caption',
                          sx: {
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '0.72rem',
                            color: 'rgba(212, 196, 240, 0.88)',
                            wordBreak: 'break-all',
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
      </Stack>

      <Box sx={{ mt: 3 }}>
        <Chip size="small" label="TM:CE → GTME.raw" variant="outlined" sx={{ mr: 1 }} />
        <Chip size="small" label="Vanilla US → GALE.raw" variant="outlined" />
      </Box>
    </Box>
  )
}
