import { describe, expect, it } from 'vitest'
import {
  deriveSelectionFromOverrides,
  selectionSetForSelectAllImportable,
} from '../src/utils/selectAllImportable'
import type { GciFolderEntry } from '../src/types/memcard'

function entry(p: Partial<GciFolderEntry> & Pick<GciFolderEntry, 'path' | 'alreadyOnCard'>): GciFolderEntry {
  return {
    fileName: 'x.gci',
    saveName: 's',
    parseError: null,
    blockCount: 4,
    mtimeMs: 0,
    ...p,
  }
}

describe('selectionSetForSelectAllImportable', () => {
  it('when card has room, adds newest not-on-card without evicting', () => {
    const candidates: GciFolderEntry[] = [
      entry({ path: '/a/new.gci', alreadyOnCard: false, mtimeMs: 100, blockCount: 4 }),
      entry({ path: '/a/old.gci', alreadyOnCard: false, mtimeMs: 10, blockCount: 4 }),
      entry({ path: '/a/on.gci', alreadyOnCard: true, mtimeMs: 50, blockCount: 4 }),
    ]
    const sel = selectionSetForSelectAllImportable(candidates, {
      directoryFileCount: 10,
      freeBlocks: 100,
    })
    expect(sel.has('/a/new.gci')).toBe(true)
    expect(sel.has('/a/old.gci')).toBe(true)
    expect(sel.has('/a/on.gci')).toBe(true)
  })

  it('when directory is full, evicts oldest on-card to fit newest import', () => {
    const onOld = entry({
      path: '/a/oldon.gci',
      alreadyOnCard: true,
      mtimeMs: 1,
      blockCount: 4,
    })
    const onMid = entry({
      path: '/a/midon.gci',
      alreadyOnCard: true,
      mtimeMs: 50,
      blockCount: 4,
    })
    const newest = entry({
      path: '/a/newest.gci',
      alreadyOnCard: false,
      mtimeMs: 200,
      blockCount: 4,
    })
    const candidates = [newest, onOld, onMid]
    const sel = selectionSetForSelectAllImportable(candidates, {
      directoryFileCount: 127,
      freeBlocks: 100,
    })
    expect(sel.has('/a/newest.gci')).toBe(true)
    expect(sel.has('/a/oldon.gci')).toBe(false)
    expect(sel.has('/a/midon.gci')).toBe(true)
  })

  it('when directory is full and many not-on-card exist, adds at most one via eviction (newest wins)', () => {
    const onCard = Array.from({ length: 127 }, (_, i) =>
      entry({
        path: `/on/${i}.gci`,
        alreadyOnCard: true,
        mtimeMs: i,
        blockCount: 4,
      }),
    )
    const offCard = Array.from({ length: 130 }, (_, i) =>
      entry({
        path: `/off/${i}.gci`,
        alreadyOnCard: false,
        mtimeMs: 10_000 + i,
        blockCount: 4,
      }),
    )
    const candidates = [...onCard, ...offCard]
    const sel = selectionSetForSelectAllImportable(candidates, {
      directoryFileCount: 127,
      freeBlocks: 50_000,
    })
    const offInSel = [...sel].filter((p) => p.startsWith('/off/')).length
    expect(offInSel).toBe(1)
    expect(sel.has('/off/129.gci')).toBe(true)
    expect(sel.has('/off/0.gci')).toBe(false)
    expect(sel.has('/on/0.gci')).toBe(false)
    expect(sel.has('/on/126.gci')).toBe(true)
  })

  it('skips an import that cannot fit alone for blocks, then still adds the next newest', () => {
    const huge = entry({
      path: '/a/huge.gci',
      alreadyOnCard: false,
      mtimeMs: 200,
      blockCount: 10000,
    })
    const small = entry({
      path: '/a/small.gci',
      alreadyOnCard: false,
      mtimeMs: 100,
      blockCount: 4,
    })
    const onCard = entry({
      path: '/a/on.gci',
      alreadyOnCard: true,
      mtimeMs: 1,
      blockCount: 4,
    })
    const candidates = [huge, small, onCard]
    const sel = selectionSetForSelectAllImportable(candidates, {
      directoryFileCount: 127,
      freeBlocks: 8,
    })
    expect(sel.has('/a/huge.gci')).toBe(false)
    expect(sel.has('/a/small.gci')).toBe(true)
    expect(sel.has('/a/on.gci')).toBe(false)
  })

  it('include override forces older not-on-card file into selection', () => {
    const oldForced = entry({
      path: '/a/old.gci',
      alreadyOnCard: false,
      mtimeMs: 1,
      blockCount: 4,
    })
    const newer = entry({
      path: '/a/new.gci',
      alreadyOnCard: false,
      mtimeMs: 100,
      blockCount: 4,
    })
    const onCard = entry({
      path: '/a/on.gci',
      alreadyOnCard: true,
      mtimeMs: 50,
      blockCount: 4,
    })
    const candidates = [newer, oldForced, onCard]
    const sel = deriveSelectionFromOverrides(
      candidates,
      { directoryFileCount: 10, freeBlocks: 100 },
      { '/a/old.gci': 'include' },
    )
    expect(sel.has('/a/old.gci')).toBe(true)
    expect(sel.has('/a/new.gci')).toBe(true)
    expect(sel.has('/a/on.gci')).toBe(true)
  })
})
