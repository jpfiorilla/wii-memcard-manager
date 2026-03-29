/**
 * Additive checksums used by GC memory card header, directory, and BAT.
 * Matches Dolphin `calc_checksumsBE` (big-endian 16-bit words).
 */
export function calcChecksumsBE(buf: Buffer, wordOffset: number, wordCount: number): { csum: number; invCsum: number } {
  let csum = 0
  let invCsum = 0
  const off = wordOffset * 2
  for (let i = 0; i < wordCount; i++) {
    const w = buf.readUInt16BE(off + i * 2)
    csum = (csum + w) & 0xffff
    invCsum = (invCsum + (w ^ 0xffff)) & 0xffff
  }
  if (csum === 0xffff) csum = 0
  if (invCsum === 0xffff) invCsum = 0
  return { csum, invCsum }
}

export function setHeaderChecksum(buf: Buffer): void {
  const { csum, invCsum } = calcChecksumsBE(buf, 0, 0xfe)
  buf.writeUInt16BE(csum, 0x1fc)
  buf.writeUInt16BE(invCsum, 0x1fe)
}

export function setDirectoryChecksum(dirBlock: Buffer): void {
  const { csum, invCsum } = calcChecksumsBE(dirBlock, 0, 0xffe)
  dirBlock.writeUInt16BE(csum, 0x1ffc)
  dirBlock.writeUInt16BE(invCsum, 0x1ffe)
}

/** BAT checksum covers from UpdateCounter (byte offset 4) for 0xffe words */
export function setBatChecksum(batBlock: Buffer): void {
  const { csum, invCsum } = calcChecksumsBE(batBlock, 2, 0xffe)
  batBlock.writeUInt16BE(csum, 0)
  batBlock.writeUInt16BE(invCsum, 2)
}

export function verifyHeaderChecksum(hdr: Buffer): boolean {
  const { csum, invCsum } = calcChecksumsBE(hdr, 0, 0xfe)
  return hdr.readUInt16BE(0x1fc) === csum && hdr.readUInt16BE(0x1fe) === invCsum
}

export function verifyDirectoryChecksum(dirBlock: Buffer): boolean {
  const { csum, invCsum } = calcChecksumsBE(dirBlock, 0, 0xffe)
  return dirBlock.readUInt16BE(0x1ffc) === csum && dirBlock.readUInt16BE(0x1ffe) === invCsum
}

export function verifyBatChecksum(batBlock: Buffer): boolean {
  const { csum, invCsum } = calcChecksumsBE(batBlock, 2, 0xffe)
  return batBlock.readUInt16BE(0) === csum && batBlock.readUInt16BE(2) === invCsum
}
