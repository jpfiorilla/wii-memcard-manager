import fs from 'node:fs/promises'
import path from 'node:path'

const VOLUMES = '/Volumes'

/** Skip typical system / internal volume names under /Volumes. */
/** Do not skip user-labeled volumes like "Data" — those are common on removable drives. */
const SKIP_VOLUME_NAMES = new Set(['Macintosh HD', 'Preboot', 'Recovery', 'VM', 'Update'])

export type VolumeMountInfo = {
  mountPath: string
  savesDir: string
}

let intervalId: ReturnType<typeof setInterval> | null = null
/** Volume paths seen on the previous poll (for unmount detection). */
let knownMounts = new Set<string>()
/**
 * Paths where `onMount` has already fired, or first-poll skip (already mounted).
 * A volume can appear in `knownMounts` before `savesDir` exists; we must not add it here until ready.
 */
let mountsReady = new Set<string>()
let firstPoll = true

async function savesDirReady(mountPath: string, nintendontSavesRelativePath: string): Promise<string | null> {
  const savesDir = path.join(mountPath, nintendontSavesRelativePath)
  try {
    const st = await fs.stat(savesDir)
    if (!st.isDirectory()) return null
  } catch {
    return null
  }
  return savesDir
}

export function startVolumeWatcherMacos(opts: {
  nintendontSavesRelativePath: string
  onMount: (info: VolumeMountInfo) => void
  onUnmount: (mountPath: string) => void
  pollMs?: number
}): void {
  if (process.platform !== 'darwin') return

  const poll = async () => {
    let names: string[]
    try {
      names = await fs.readdir(VOLUMES)
    } catch {
      return
    }

    const current = new Set<string>()
    for (const name of names) {
      if (name.startsWith('.')) continue
      if (SKIP_VOLUME_NAMES.has(name)) continue
      current.add(path.join(VOLUMES, name))
    }

    if (firstPoll) {
      for (const m of current) {
        const savesDir = await savesDirReady(m, opts.nintendontSavesRelativePath)
        if (savesDir !== null) mountsReady.add(m)
      }
      knownMounts = current
      firstPoll = false
      return
    }

    for (const k of knownMounts) {
      if (!current.has(k)) {
        opts.onUnmount(k)
        mountsReady.delete(k)
      }
    }

    for (const m of current) {
      if (mountsReady.has(m)) continue
      const savesDir = await savesDirReady(m, opts.nintendontSavesRelativePath)
      if (savesDir === null) continue
      opts.onMount({ mountPath: m, savesDir })
      mountsReady.add(m)
    }

    knownMounts = current
  }

  void poll()
  intervalId = setInterval(() => void poll(), opts.pollMs ?? 1000)
}

export function stopVolumeWatcher(): void {
  if (intervalId) clearInterval(intervalId)
  intervalId = null
  knownMounts = new Set()
  mountsReady = new Set()
  firstPoll = true
}
