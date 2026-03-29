import fs from 'node:fs'
import path from 'node:path'
import { nativeImage } from 'electron'

/** 1×1 PNG fallback — resized so the menu bar always has a visible glyph. */
const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function dirsToSearch(appRoot: string | undefined, vitePublic: string | undefined): string[] {
  const publicDir = appRoot ? path.join(appRoot, 'public') : undefined
  return [publicDir, vitePublic].filter(Boolean) as string[]
}

/**
 * Menu bar (macOS): **monochrome template** PNG (black + alpha only).
 * `createFromBuffer` with `scaleFactor: 2` for 44×44 px bitmap → **22pt** logical size
 * (same as `NSStatusItem` icons). `setTemplateImage(true)` for light/dark menu bar tint.
 */
export function createTrayMenuBarImage(
  appRoot: string | undefined,
  vitePublic: string | undefined,
): Electron.NativeImage {
  const names = ['tray-menu.png', 'trayTemplate.png'] as const
  for (const dir of dirsToSearch(appRoot, vitePublic)) {
    for (const name of names) {
      const p = path.join(dir, name)
      if (!fs.existsSync(p)) continue
      const buf = fs.readFileSync(p)
      const img = nativeImage.createFromBuffer(buf, { scaleFactor: 2 })
      if (process.platform === 'darwin') {
        img.setTemplateImage(true)
      }
      if (!img.isEmpty()) return img
    }
  }
  const fb = nativeImage.createFromBuffer(FALLBACK_PNG).resize({ width: 22, height: 22 })
  if (!fb.isEmpty()) return fb
  return nativeImage.createFromBuffer(FALLBACK_PNG)
}

/** Dock / window: colored app icon. */
export function createAppWindowIcon(
  appRoot: string | undefined,
  vitePublic: string | undefined,
): Electron.NativeImage {
  const names = ['app-icon.png', 'icon.png', 'favicon.ico', 'trayTemplate.png'] as const
  for (const dir of dirsToSearch(appRoot, vitePublic)) {
    for (const name of names) {
      const p = path.join(dir, name)
      if (fs.existsSync(p)) {
        const img = nativeImage.createFromPath(p)
        if (!img.isEmpty()) return img
      }
    }
  }
  const pub = appRoot ? path.join(appRoot, 'public') : undefined
  if (pub) {
    const p = path.join(pub, 'trayTemplate.png')
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return img
    }
  }
  return nativeImage.createFromBuffer(FALLBACK_PNG).resize({ width: 64, height: 64 })
}
