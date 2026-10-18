import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import dgram from 'node:dgram'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {

/** Only TM Sync's own downloads count as delivered. */
const TM = { 'User-Agent': 'tm-sync/1.0.0' }
  crc32,
  etagFor,
  ifNoneMatchHits,
  startWiiSyncServer,
  type WiiSyncDelivery,
  type WiiSyncServerHandle,
} from '../electron/main/wiiSyncServer'

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
  })
})

describe('ifNoneMatchHits', () => {
  it('handles quotes, weak tags, lists and *', () => {
    expect(ifNoneMatchHits('"abc-1"', 'abc-1')).toBe(true)
    expect(ifNoneMatchHits('W/"abc-1"', 'abc-1')).toBe(true)
    expect(ifNoneMatchHits('"x", "abc-1"', 'abc-1')).toBe(true)
    expect(ifNoneMatchHits('*', 'abc-1')).toBe(true)
    expect(ifNoneMatchHits('"abc-2"', 'abc-1')).toBe(false)
    expect(ifNoneMatchHits(undefined, 'abc-1')).toBe(false)
  })
})

describe('TM Sync server', () => {
  let dir: string
  let srv: WiiSyncServerHandle
  const delivered: WiiSyncDelivery[] = []
  const base = () => `http://127.0.0.1:${srv.port}`

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tmsync-'))
    srv = await startWiiSyncServer({
      port: 0,
      discoveryPort: 0,
      resolveSavePath: async (name) => path.join(dir, name),
      onDelivered: (d) => delivered.push(d),
    })
  })
  afterAll(async () => {
    await srv.close()
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('404s when nothing is staged', async () => {
    const r = await fetch(`${base()}/tmsync/v1/saves/GTME.raw`)
    expect(r.status).toBe(404)
  })

  it('rejects path traversal / bad names', async () => {
    expect((await fetch(`${base()}/tmsync/v1/saves/..%2Fx.raw`)).status).toBe(404)
    expect((await fetch(`${base()}/tmsync/v1/saves/TOOLONG.raw`)).status).toBe(404)
  })

  it('serves the image with an ETag, then 304s until it changes', async () => {
    const v1 = Buffer.alloc(4096, 1)
    await fs.writeFile(path.join(dir, 'GTME.raw'), v1)

    const r1 = await fetch(`${base()}/tmsync/v1/saves/gtme.raw`, { headers: TM })
    expect(r1.status).toBe(200)
    const body = Buffer.from(await r1.arrayBuffer())
    expect(body.equals(v1)).toBe(true)
    const etag = r1.headers.get('etag')!
    expect(etag).toBe(`"${etagFor(v1)}"`)
    expect(r1.headers.get('x-tmsync-crc32')).toBe(crc32(v1).toString(16).padStart(8, '0'))
    await new Promise((r) => setTimeout(r, 20))
    expect(delivered.at(-1)?.fileName).toBe('GTME.raw')

    const r2 = await fetch(`${base()}/tmsync/v1/saves/GTME.raw`, { headers: { ...TM, 'If-None-Match': etag } })
    expect(r2.status).toBe(304)
    expect((await r2.arrayBuffer()).byteLength).toBe(0)

    // Rewriting identical bytes (new mtime) still 304s: identity is content, not timestamps.
    await new Promise((r) => setTimeout(r, 20))
    await fs.writeFile(path.join(dir, 'GTME.raw'), v1)
    const r3 = await fetch(`${base()}/tmsync/v1/saves/GTME.raw`, { headers: { ...TM, 'If-None-Match': etag } })
    expect(r3.status).toBe(304)

    const v2 = Buffer.alloc(4096, 2)
    await fs.writeFile(path.join(dir, 'GTME.raw'), v2)
    const r4 = await fetch(`${base()}/tmsync/v1/saves/GTME.raw`, { headers: { ...TM, 'If-None-Match': etag } })
    expect(r4.status).toBe(200)
    expect(Buffer.from(await r4.arrayBuffer()).equals(v2)).toBe(true)
  })

  it('answers UDP discovery with the HTTP port', async () => {
    const sock = dgram.createSocket('udp4')
    const reply = await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('no reply')), 2000)
      sock.on('message', (m) => {
        clearTimeout(t)
        resolve(m.toString())
      })
      sock.send(Buffer.from('TMSYNC_DISCOVER 1\n'), srv.discoveryPort, '127.0.0.1')
    })
    sock.close()
    expect(reply.trim()).toBe(`TMSYNC_HERE 1 ${srv.port}`)
  })
})
