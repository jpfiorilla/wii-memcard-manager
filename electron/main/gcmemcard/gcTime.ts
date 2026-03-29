/** Unix seconds at 2000-01-01 00:00:00 UTC (GameCube card `m_time` epoch). */
export const GC_CARD_TIME_EPOCH_UNIX_SECONDS = 946684800

/** Seconds since 2000-01-01 00:00:00 UTC (dentry `m_time` at offset 0x28). */
export function gcTimestampSecondsFromUnixMs(ms: number): number {
  return Math.floor(ms / 1000) - GC_CARD_TIME_EPOCH_UNIX_SECONDS
}
