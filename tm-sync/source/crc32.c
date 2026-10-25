#include "crc32.h"

uint32_t crc32_buf(const void *data, size_t len)
{
	static uint32_t table[256];
	static int ready = 0;
	if (!ready) {
		for (uint32_t n = 0; n < 256; n++) {
			uint32_t c = n;
			for (int k = 0; k < 8; k++)
				c = (c & 1) ? 0xEDB88320u ^ (c >> 1) : (c >> 1);
			table[n] = c;
		}
		ready = 1;
	}
	const uint8_t *p = (const uint8_t *)data;
	uint32_t c = 0xFFFFFFFFu;
	while (len--)
		c = table[(c ^ *p++) & 0xFF] ^ (c >> 8);
	return c ^ 0xFFFFFFFFu;
}
