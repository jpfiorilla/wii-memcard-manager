import fs from 'node:fs/promises'
import path from 'node:path'

const VOLUMES = '/Volumes'

/** Skip typical system / internal volume names under /Volumes. */
const SKIP_VOLUME_NAMES = new Set(['Macintosh HD', 'Preboot', 'Recovery', 'VM', 'Update', 'Data'])

export type VolumeMountInfo = {
  mountPath: string
  savesDir: string
}

let intervalId: ReturnType<typeof setInterval> | null = null
let knownMounts = new Set<string>()
let firstPoll = true

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
      knownMounts = current
      firstPoll = false
      return
    }

    for (const m of current) {
      if (!knownMounts.has(m)) {
        const savesDir = path.join(m, opts.nintendontSavesRelativePath)
        try {
          const st = await fs.stat(savesDir)
          if (!st.isDirectory()) continue
        } catch {
          continue
        }
        opts.onMount({ mountPath: m, savesDir })
      }
    }

    for (const k of knownMounts) {
      if (!current.has(k)) opts.onUnmount(k)
    }

    knownMounts = current
  }

  void poll()
  intervalId = setInterval(() => void poll(), opts.pollMs ?? 2000)
}

export function stopVolumeWatcher(): void {
  if (intervalId) clearInterval(intervalId)
  intervalId = null
  knownMounts = new Set()
  firstPoll = true
}
