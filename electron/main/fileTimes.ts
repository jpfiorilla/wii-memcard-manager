import fs from 'node:fs/promises'
import path from 'node:path'

/** Sets access and modification time to the same instant (typical “modified” vs “accessed” parity in listings). */
export async function touchFileAccessAndModified(filePath: string) {
  const d = new Date()
  await fs.utimes(filePath, d, d)
}

/**
 * Replace a file so creation time (birthtime) matches this write. On APFS, Finder’s “Date Created”
 * comes from birthtime; `writeFile()` to an existing path keeps the old birthtime while mtime updates.
 * Write to a temp name in the same directory, then rename into place (atomic replace on POSIX).
 */
export async function writeFileReplacingBirthtime(filePath: string, data: Buffer): Promise<void> {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  const tmp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`)
  await fs.writeFile(tmp, data)
  if (process.platform === 'win32') {
    await fs.unlink(filePath).catch(() => {
      /* ENOENT: new file */
    })
    await fs.rename(tmp, filePath)
    return
  }
  try {
    await fs.rename(tmp, filePath)
  } catch (e) {
    await fs.unlink(tmp).catch(() => {})
    throw e
  }
}
