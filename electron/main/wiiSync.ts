/**
 * Electron glue for the TM Sync server: start/stop from user settings, report status,
 * and tie deliveries back into the pending-SD queue.
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import { app } from 'electron'
import { resolveStagingDir } from './gciBatchPipeline'
import { removePendingByLocalPath } from './pendingSdQueue'
import { readUserSettings } from './userSettings'
import {
  lanIPv4Addresses,
  startWiiSyncServer,
  type WiiSyncDelivery,
  type WiiSyncRequestLog,
  type WiiSyncServerHandle,
} from './wiiSyncServer'

export type WiiSyncStatus = {
  enabled: boolean
  running: boolean
  port: number | null
  discovery: boolean
  addresses: string[]
  error: string | null
  lastRequest: WiiSyncRequestLog | null
}

let handle: WiiSyncServerHandle | null = null
let lastError: string | null = null
let lastRequest: WiiSyncRequestLog | null = null
let reconfiguring: Promise<void> = Promise.resolve()

type Broadcast = (channel: string, payload: unknown) => void

export function reconfigureWiiSync(broadcast: Broadcast): Promise<void> {
  reconfiguring = reconfiguring.then(() => doReconfigure(broadcast)).catch(() => {})
  return reconfiguring
}

async function doReconfigure(broadcast: Broadcast) {
  const s = await readUserSettings()
  const wantPort = s.wiiSyncPort
  if (handle && (!s.wiiSyncEnabled || handle.port !== wantPort)) {
    await handle.close()
    handle = null
  }
  if (!s.wiiSyncEnabled || handle) {
    broadcast('memcard:wii-sync-status', await getWiiSyncStatus())
    return
  }
  try {
    handle = await startWiiSyncServer({
      port: wantPort,
      resolveSavePath: async (fileName) => {
        const latest = await readUserSettings()
        return path.join(resolveStagingDir(latest), fileName)
      },
      onRequest: (r) => {
        lastRequest = r
        broadcast('memcard:wii-sync-request', r)
      },
      onDelivered: (d: WiiSyncDelivery) => {
        // The Wii now has this image; no need to also copy it on the next SD mount.
        void removePendingByLocalPath(d.localPath)
        broadcast('memcard:wii-sync-delivered', d)
      },
      onWiiLog: async (text, remote) => {
        // The Wii sends the tail of sd:/apps/tm-sync/tmsync.log after each run that reaches the Mac.
        const file = path.join(app.getPath('logs'), 'wii-tmsync.log')
        await fs.writeFile(file, text, 'latin1')
        console.log(`[tmsync] saved the Wii's log from ${remote} (${text.length} bytes) to ${file}`)
      },
      expectedClientVersion: app.getVersion(),
      log: (m) => console.log(m),
    })
    lastError = null
  } catch (e) {
    handle = null
    lastError = e instanceof Error ? e.message : String(e)
  }
  broadcast('memcard:wii-sync-status', await getWiiSyncStatus())
}

export async function getWiiSyncStatus(): Promise<WiiSyncStatus> {
  const s = await readUserSettings()
  return {
    enabled: s.wiiSyncEnabled,
    running: handle !== null,
    port: handle?.port ?? null,
    discovery: handle ? handle.discoveryPort !== -1 : false,
    addresses: lanIPv4Addresses(),
    error: lastError,
    lastRequest,
  }
}

export async function stopWiiSync(): Promise<void> {
  if (handle) {
    await handle.close()
    handle = null
  }
}
