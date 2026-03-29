import fs from 'node:fs/promises'

/** Sets access and modification time to the same instant (typical “modified” vs “accessed” parity in listings). */
export async function touchFileAccessAndModified(filePath: string) {
  const d = new Date()
  await fs.utimes(filePath, d, d)
}
