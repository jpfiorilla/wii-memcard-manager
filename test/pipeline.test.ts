import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { dentryGameCodeString } from '../electron/main/gcmemcard/dentry'
import { isPathInsideRoot } from '../electron/main/sdTransfer'

describe('dentryGameCodeString', () => {
  it('reads 4-char game code', () => {
    const d = Buffer.alloc(0x40, 0)
    d.write('GTME', 0, 4, 'ascii')
    expect(dentryGameCodeString(d)).toBe('GTME')
  })

  it('handles short code', () => {
    const d = Buffer.alloc(0x40, 0)
    d[0] = 'A'.charCodeAt(0)
    d[1] = 'B'.charCodeAt(0)
    expect(dentryGameCodeString(d)).toBe('AB')
  })
})

describe('isPathInsideRoot', () => {
  it('allows child under root', () => {
    const root = '/Volumes/WiiSD'
    const child = path.join(root, 'nintendont', 'saves', 'GTME.raw')
    expect(isPathInsideRoot(root, child)).toBe(true)
  })

  it('rejects escape', () => {
    const root = '/Volumes/WiiSD'
    const bad = path.resolve(root, '..', 'Other', 'x.raw')
    expect(isPathInsideRoot(root, bad)).toBe(false)
  })
})
