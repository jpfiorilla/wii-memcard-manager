/**
 * TM Sync server — lets the Wii-side "TM Sync" homebrew app pull the latest staged
 * memory card image (e.g. GTME.raw) over the LAN right before it boots Slippi Nintendont.
 *
 * Pure Node (no Electron imports) so it can be unit-tested.
 *
 * HTTP (default port 8642):
 *   GET  /tmsync/v1/ping                 -> "tmsync 1\n"
 *   GET  /tmsync/v1/saves/<CODE>.raw     -> the card image
 *   HEAD /tmsync/v1/saves/<CODE>.raw     -> headers only
 *
 * Change detection: every image gets a strong ETag derived from its CRC32 + size.
 * The Wii stores the ETag of the last image it pulled and sends it back as
 * `If-None-Match`; if nothing new was built we answer 304 with no body, so the
 * Wii never re-downloads (or rewrites its SD card) unless the Mac has something newer.
 *
 * UDP discovery (port 8643): a datagram starting with "TMSYNC_DISCOVER" gets the
 * reply "TMSYNC_HERE 1 <httpPort>\n" so the Wii can find the Mac without a fixed IP.
 */
import http from 'node:http'
import dgram from 'node:dgram'
import fs from 'node:fs/promises'
import os from 'node:os'

export const TMSYNC_DEFAULT_HTTP_PORT = 8642
export const TMSYNC_DISCOVERY_PORT = 8643
const SAVE_ROUTE = /^\/tmsync\/v1\/saves\/([A-Za-z0-9]{4})\.raw$/

// ---------------------------------------------------------------------------
// CRC32 (IEEE 802.3, reflected 0xEDB88320) — must match tm-sync/source/crc32.c
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function crcHex(n: number): string {
  return n.toString(16).padStart(8, '0')
}

/** ETag body (without quotes): `<crc32hex>-<sizeHex>`. */
export function etagFor(buf: Uint8Array): string {
  return `${crcHex(crc32(buf))}-${buf.length.toString(16)}`
}

/** True if an If-None-Match header value matches our etag (handles quotes, W/, lists, `*`). */
export function ifNoneMatchHits(header: string | undefined, etag: string): boolean {
  if (!header) return false
  return header
    .split(',')
    .map((s) => s.trim().replace(/^W\//, '').replace(/^"|"$/g, ''))
    .some((t) => t === '*' || t === etag)
}

export type WiiSyncDelivery = {
  fileName: string
  localPath: string
  etag: string
  bytes: number
  remoteAddress: string | undefined
}

export type WiiSyncRequestLog = {
  at: number
  remoteAddress: string | undefined
  fileName: string
  status: number
}

export type WiiSyncServerOptions = {
  port?: number
  discoveryPort?: number
  /** Return an absolute path for e.g. `GTME.raw`, or null if there is nothing to serve. */
  resolveSavePath: (fileName: string) => Promise<string | null>
  /** Called after a full 200 body has been written to the Wii. */
  onDelivered?: (d: WiiSyncDelivery) => void
  onRequest?: (r: WiiSyncRequestLog) => void
  log?: (msg: string) => void
}

export type WiiSyncServerHandle = {
  port: number
  discoveryPort: number
  close: () => Promise<void>
}

type CacheEntry = { mtimeMs: number; size: number; buf: Buffer; etag: string }

export async function startWiiSyncServer(opts: WiiSyncServerOptions): Promise<WiiSyncServerHandle> {
  const port = opts.port ?? TMSYNC_DEFAULT_HTTP_PORT
  const discoveryPort = opts.discoveryPort ?? TMSYNC_DISCOVERY_PORT
  const log = opts.log ?? (() => {})
  const cache = new Map<string, CacheEntry>()

  async function load(absPath: string): Promise<CacheEntry | null> {
    let st
    try {
      st = await fs.stat(absPath)
    } catch {
      return null
    }
    if (!st.isFile()) return null
    const hit = cache.get(absPath)
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit
    const buf = await fs.readFile(absPath)
    const entry: CacheEntry = { mtimeMs: st.mtimeMs, size: buf.length, buf, etag: etagFor(buf) }
    cache.set(absPath, entry)
    return entry
  }

  const server = http.createServer((req, res) => {
    void (async () => {
      const url = (req.url ?? '/').split('?')[0]
      const remote = req.socket.remoteAddress
      const send = (status: number, body: string, fileName = '') => {
        res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' })
        res.end(req.method === 'HEAD' ? undefined : body)
        if (fileName) opts.onRequest?.({ at: Date.now(), remoteAddress: remote, fileName, status })
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'method not allowed\n')
      if (url === '/tmsync/v1/ping') return send(200, 'tmsync 1\n')

      const m = SAVE_ROUTE.exec(url)
      if (!m) return send(404, 'not found\n')
      const fileName = `${m[1].toUpperCase()}.raw`

      const abs = await opts.resolveSavePath(fileName)
      const entry = abs ? await load(abs) : null
      if (!abs || !entry) return send(404, `no staged ${fileName}\n`, fileName)

      const headers = {
        ETag: `"${entry.etag}"`,
        'X-TMSync-CRC32': crcHex(crc32(entry.buf)),
        'Last-Modified': new Date(entry.mtimeMs).toUTCString(),
        'Cache-Control': 'no-cache',
        Connection: 'close',
      }

      if (ifNoneMatchHits(req.headers['if-none-match'], entry.etag)) {
        res.writeHead(304, headers)
        res.end()
        log(`[tmsync] ${remote} ${fileName} 304 (up to date)`)
        opts.onRequest?.({ at: Date.now(), remoteAddress: remote, fileName, status: 304 })
        return
      }

      res.writeHead(200, {
        ...headers,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(entry.buf.length),
      })
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.end(entry.buf, () => {
        log(`[tmsync] ${remote} ${fileName} 200 (${entry.buf.length} bytes, etag ${entry.etag})`)
        opts.onRequest?.({ at: Date.now(), remoteAddress: remote, fileName, status: 200 })
        opts.onDelivered?.({
          fileName,
          localPath: abs,
          etag: entry.etag,
          bytes: entry.buf.length,
          remoteAddress: remote,
        })
      })
    })().catch((e) => {
      log(`[tmsync] error: ${e instanceof Error ? e.message : String(e)}`)
      if (!res.headersSent) res.writeHead(500, { Connection: 'close' })
      res.end()
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const actualPort = (server.address() as { port: number }).port

  const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  udp.on('message', (msg, rinfo) => {
    if (!msg.toString('latin1').startsWith('TMSYNC_DISCOVER')) return
    const reply = Buffer.from(`TMSYNC_HERE 1 ${actualPort}\n`, 'latin1')
    udp.send(reply, rinfo.port, rinfo.address)
    log(`[tmsync] discovery from ${rinfo.address}:${rinfo.port}`)
  })
  let actualDiscoveryPort = discoveryPort
  try {
    await new Promise<void>((resolve, reject) => {
      udp.once('error', reject)
      udp.bind(discoveryPort, '0.0.0.0', () => {
        udp.off('error', reject)
        resolve()
      })
    })
    actualDiscoveryPort = udp.address().port
  } catch (e) {
    // HTTP still works with a fixed host= in the Wii's config.ini.
    log(`[tmsync] discovery disabled: ${e instanceof Error ? e.message : String(e)}`)
    actualDiscoveryPort = -1
  }

  return {
    port: actualPort,
    discoveryPort: actualDiscoveryPort,
    close: async () => {
      await new Promise<void>((r) => server.close(() => r()))
      server.closeAllConnections?.()
      if (actualDiscoveryPort !== -1) await new Promise<void>((r) => udp.close(() => r()))
    },
  }
}

/** Non-internal IPv4 addresses, for showing the user what to put in config.ini. */
export function lanIPv4Addresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address)
    }
  }
  return out
}
