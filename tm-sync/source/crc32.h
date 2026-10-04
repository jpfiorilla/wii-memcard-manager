#ifndef TMSYNC_CRC32_H
#define TMSYNC_CRC32_H
#include <stddef.h>
#include <stdint.h>

/* IEEE CRC-32 (zlib/PNG), identical to crc32() in electron/main/wiiSyncServer.ts. */
uint32_t crc32_buf(const void *data, size_t len);

#endif
