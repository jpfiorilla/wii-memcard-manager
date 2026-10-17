/**
 * Keeps TM Sync on the Wii's SD card pointed at this Mac. Whenever a Wii SD card with
 * apps/tm-sync/config.ini is mounted, host= and port= are set to this Mac's current LAN address
 * and the TM Sync port, so nobody has to look up or type an IP. If the Mac's address changes
 * later, TM Sync falls back to searching the network, and the next SD mount fixes config.ini.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const isPrivate = (ip: string) =>
  ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)

/** Best guess at the address the Wii can reach: a private IPv4, preferring Wi-Fi/Ethernet (en*). */
export function preferredLanAddress(): string | null {
  const candidates: { name: string; ip: string }[] = []
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && isPrivate(a.address)) candidates.push({ name, ip: a.address })
    }
  }
  candidates.sort((a, b) => Number(b.name.startsWith('en')) - Number(a.name.startsWith('en')) || a.name.localeCompare(b.name))
  return candidates[0]?.ip ?? null
}

function setKey(ini: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*$`, 'm')
  return re.test(ini) ? ini.replace(re, `${key}=${value}`) : `${ini.replace(/\n?$/, '\n')}${key}=${value}\n`
}

/** Returns true if config.ini was changed. */
export async function pointTmSyncAtThisMac(mountPath: string, port: number): Promise<boolean> {
  const file = path.join(mountPath, 'apps', 'tm-sync', 'config.ini')
  let ini: string
  try {
    ini = await fs.readFile(file, 'utf-8')
  } catch {
    return false // no TM Sync on this card
  }
  const ip = preferredLanAddress()
  if (!ip) {
    console.warn('[tm-sync-config] no LAN address found; leaving config.ini alone')
    return false
  }
  const next = setKey(setKey(ini, 'host', ip), 'port', String(port))
  if (next === ini) return false
  await fs.writeFile(file, next, 'utf-8')
  console.log(`[tm-sync-config] ${file}: host=${ip} port=${port}`)
  return true
}
