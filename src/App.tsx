import { useEffect, useState } from 'react'
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
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import SaveIcon from '@mui/icons-material/Save'
import { useSnackbar } from 'notistack'

export default function App() {
  const { enqueueSnackbar } = useSnackbar()
  const [gciFolder, setGciFolder] = useState<string | null>(null)
  const [gciPath, setGciPath] = useState<string | null>(null)
  const [rawPath, setRawPath] = useState<string | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const s = await window.memcard.getUserSettings()
      if (cancelled) return
      if (s.gciFolder) setGciFolder(s.gciFolder)
      if (s.rawPath) setRawPath(s.rawPath)
      if (s.lastGciPath) setGciPath(s.lastGciPath)
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
    if (!gciFolder) return () => undefined
    const unsub = window.memcard.onFolderChanged((ev) => {
      const line = `${ev.eventKind} ${ev.filePath}`
      setEvents((prev) => [line, ...prev].slice(0, 40))
    })
    return unsub
  }, [gciFolder])

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

  const pickGci = async () => {
    const p = await window.memcard.pickFile([{ name: 'GCI save', extensions: ['gci'] }])
    if (!p) return
    setGciPath(p)
    await window.memcard.mergeUserSettings({ lastGciPath: p })
    enqueueSnackbar(`GCI: ${p}`, { variant: 'success' })
  }

  const importGci = async () => {
    if (!rawPath || !gciPath) {
      enqueueSnackbar('Choose both a target .raw and a .gci file', { variant: 'warning' })
      return
    }
    const res = await window.memcard.importGci(rawPath, gciPath)
    if (res.ok) {
      enqueueSnackbar('Imported GCI into memory card', { variant: 'success' })
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Watches synced folders (Drive, exports). Import merges a .gci into the chosen Nintendont .raw (backup is
        created under <code>backups/</code> before each import). Your folder, .raw, and last .gci paths are remembered
        until you change them.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Paper sx={{ p: 2, flex: 1, width: '100%' }}>
          <Typography variant="subtitle1" gutterBottom>
            Sources
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                .gci folder (sync / exports)
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <Button startIcon={<FolderOpenIcon />} variant="contained" color="secondary" onClick={pickGciFolder}>
                  Choose folder
                </Button>
                <Button variant="outlined" onClick={toggleWatch} disabled={!gciFolder}>
                  {watching ? 'Stop watch' : 'Watch folder'}
                </Button>
              </Stack>
              {gciFolder && (
                <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>
                  {gciFolder}
                </Typography>
              )}
            </Box>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Target .raw (e.g. saves/GTME.raw)
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <Button startIcon={<SaveIcon />} variant="outlined" onClick={pickRaw}>
                  Choose .raw
                </Button>
                <Button variant="text" size="small" onClick={testBackup} disabled={!rawPath}>
                  Test backup now
                </Button>
              </Stack>
              {rawPath && (
                <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>
                  {rawPath}
                </Typography>
              )}
            </Box>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary">
                .gci to import
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" onClick={pickGci}>
                  Choose .gci
                </Button>
                <Button variant="contained" color="primary" onClick={importGci} disabled={!rawPath || !gciPath}>
                  Import into .raw
                </Button>
              </Stack>
              {gciPath && (
                <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all' }}>
                  {gciPath}
                </Typography>
              )}
            </Box>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, flex: 1, width: '100%', minHeight: 280 }}>
          <Typography variant="subtitle1" gutterBottom>
            Recent folder activity
          </Typography>
          {events.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Add a folder and start watch to see Drive / export updates here.
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
              {events.map((line, i) => (
                <ListItem key={i}>
                  <ListItemText
                    primaryTypographyProps={{
                      variant: 'caption',
                      sx: {
                        fontFamily: 'ui-monospace, monospace',
                        color: 'rgba(212, 196, 240, 0.92)',
                      },
                    }}
                    primary={line}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Stack>

      <Box sx={{ mt: 2 }}>
        <Chip size="small" label="TM:CE → GTME.raw" variant="outlined" sx={{ mr: 1 }} />
        <Chip size="small" label="Vanilla US → GALE.raw" variant="outlined" />
      </Box>
    </Box>
  )
}
