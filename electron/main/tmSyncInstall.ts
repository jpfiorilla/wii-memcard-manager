/**
 * The Mac app carries TM Sync (the Wii homebrew half) and keeps every Wii SD card's copy in step
 * with itself. When a Wii SD card is mounted:
 *   - no apps/tm-sync yet  -> install it (boot.dol, meta.xml, default config.ini)
 *   - a different version  -> replace boot.dol + meta.xml (config.ini is kept)
 * "Different", not "older": the app and TM Sync ship as one release and speak one protocol, so the
 * card should always match the app, including after a downgrade.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

export type TmSyncCardResult =
  | { action: 'installed' | 'updated'; version: string; from?: string }
  | { action: 'current'; version: string }
  | { action: 'skipped'; reason: string }

const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false,
  )

const versionOf = (metaXml: string) => /<version>([^<]+)<\/version>/.exec(metaXml)?.[1]?.trim() ?? null

/** Where the bundled TM Sync lives: Resources/tm-sync when packaged, build/tm-sync-bundle in dev. */
export function bundledTmSyncDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'tm-sync')
    : path.join(process.env.APP_ROOT ?? process.cwd(), 'build', 'tm-sync-bundle')
}

export async function bundledTmSyncVersion(): Promise<string | null> {
  try {
    return versionOf(await fs.readFile(path.join(bundledTmSyncDir(), 'meta.xml'), 'utf-8'))
  } catch {
    return null
  }
}

/** Looks like an SD card set up for Nintendont on a Wii (not some random USB stick). */
async function isWiiSdCard(mountPath: string): Promise<boolean> {
  if (!(await exists(path.join(mountPath, 'apps')))) return false
  return (
    (await exists(path.join(mountPath, 'apps', 'Nintendont'))) ||
    (await exists(path.join(mountPath, 'apps', 'nintendont'))) ||
    (await exists(path.join(mountPath, 'saves'))) ||
    (await exists(path.join(mountPath, 'apps', 'tm-sync')))
  )
}

export async function syncTmSyncOnCard(mountPath: string): Promise<TmSyncCardResult> {
  const bundle = bundledTmSyncDir()
  const version = await bundledTmSyncVersion()
  if (!version || !(await exists(path.join(bundle, 'boot.dol')))) {
    return { action: 'skipped', reason: 'this build of the app has no TM Sync bundled' }
  }
  if (!(await isWiiSdCard(mountPath))) return { action: 'skipped', reason: 'not a Wii SD card' }

  const dest = path.join(mountPath, 'apps', 'tm-sync')
  let cardVersion: string | null = null
  try {
    cardVersion = versionOf(await fs.readFile(path.join(dest, 'meta.xml'), 'utf-8'))
  } catch {
    /* not installed */
  }
  if (cardVersion === version) {
    const [a, b] = await Promise.all([
      fs.stat(path.join(dest, 'boot.dol')).catch(() => null),
      fs.stat(path.join(bundle, 'boot.dol')),
    ])
    if (a && a.size === b.size) return { action: 'current', version }
  }

  await fs.mkdir(dest, { recursive: true })
  await fs.copyFile(path.join(bundle, 'boot.dol'), path.join(dest, 'boot.dol'))
  await fs.copyFile(path.join(bundle, 'meta.xml'), path.join(dest, 'meta.xml'))
  if (!(await exists(path.join(dest, 'config.ini')))) {
    await fs.copyFile(path.join(bundle, 'config.ini'), path.join(dest, 'config.ini'))
  }
  return cardVersion
    ? { action: 'updated', version, from: cardVersion }
    : { action: 'installed', version }
}
