import fs from 'node:fs/promises'
import path from 'node:path'
import { showMemcardNotification } from './notifications'

export async function copyLocalRawToSdSaves(opts: {
  localPath: string
  savesDir: string
  destFileName: string
  /** macOS: show Notification Center messages (backup + copy steps). */
  notify?: boolean
}): Promise<{ ok: true; destPath: string } | { ok: false; error: string }> {
  const destPath = path.join(opts.savesDir, opts.destFileName)
  const notify = opts.notify === true && process.platform === 'darwin'

  try {
    await fs.mkdir(opts.savesDir, { recursive: true })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  try {
    const st = await fs.stat(destPath)
    if (st.isFile()) {
      const backupsDir = path.join(opts.savesDir, 'backups')
      if (notify) {
        showMemcardNotification(
          'SD card: backing up existing save',
          `Archiving the current ${opts.destFileName} into:\n${backupsDir}\n(timestamped) before writing the new file.`,
        )
      }
      await fs.mkdir(backupsDir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const ext = path.extname(opts.destFileName) || '.raw'
      const base = path.basename(opts.destFileName, ext)
      await fs.copyFile(destPath, path.join(backupsDir, `${base}-before-copy-${stamp}${ext}`))
    }
  } catch {
    /* dest missing */
  }

  if (notify) {
    showMemcardNotification(
      'SD card: copying new memory card file',
      `Copying ${opts.destFileName} from staging to:\n${destPath}`,
    )
  }

  try {
    await fs.copyFile(opts.localPath, destPath)
    return { ok: true, destPath }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Ensure `resolvedChild` is under `root` (after path.resolve). */
export function isPathInsideRoot(root: string, resolvedChild: string): boolean {
  const r = path.resolve(root) + path.sep
  const c = path.resolve(resolvedChild)
  return c === path.resolve(root) || c.startsWith(r)
}
