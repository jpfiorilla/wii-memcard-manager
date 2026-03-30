import { describe, expect, it } from 'vitest'
import { formatFolderRelativeTime } from '../src/utils/formatFolderRelativeTime'

describe('formatFolderRelativeTime', () => {
  it('shows Today for same calendar day', () => {
    const now = new Date(2026, 2, 29, 15, 0, 0).getTime()
    const file = new Date(2026, 2, 29, 14, 25, 0).getTime()
    const s = formatFolderRelativeTime(file, now)
    expect(s.startsWith('Today at ')).toBe(true)
    expect(s.toLowerCase()).toMatch(/today at \d{1,2}:\d{2}(am|pm)/)
  })

  it('shows Yesterday for previous calendar day', () => {
    const now = new Date(2026, 2, 29, 10, 0, 0).getTime()
    const file = new Date(2026, 2, 28, 9, 10, 0).getTime()
    expect(formatFolderRelativeTime(file, now).startsWith('Yesterday at ')).toBe(true)
  })

  it('shows N days ago', () => {
    const now = new Date(2026, 2, 29, 12, 0, 0).getTime()
    const file = new Date(2026, 2, 25, 8, 0, 0).getTime()
    expect(formatFolderRelativeTime(file, now)).toMatch(/^4 days ago at /)
  })
})
