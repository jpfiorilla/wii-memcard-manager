#ifndef TMSYNC_NETIO_H
#define TMSYNC_NETIO_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define TMSYNC_DISCOVERY_PORT 8643

typedef struct {
	int status;           /* HTTP status, e.g. 200 / 304 / 404 */
	uint8_t *body;        /* malloc'd; caller frees */
	uint32_t body_len;
	char etag[96];        /* ETag header value, quotes included */
	uint32_t crc;         /* X-TMSync-CRC32 */
	bool has_crc;
} tm_http_result;

uint64_t tm_now_ms(void);

/* Bring up Wi-Fi/Ethernet using the Wii's saved connection; false on timeout/failure. */
bool tm_net_up(uint64_t deadline_ms, char *err, size_t errlen);
void tm_net_down(void);
uint32_t tm_local_ip(void);

bool tm_parse_ipv4(const char *s, uint32_t *out_host_order);
void tm_format_ipv4(uint32_t ip_host_order, char *buf, size_t len);

/* Find the Mac: unicast to `hint` (if nonzero) and broadcast. Returns its IP + HTTP port. */
bool tm_discover(uint32_t hint_ip, uint64_t deadline_ms, uint32_t *out_ip, int *out_port);

/* Plain HTTP/1.0 GET with optional If-None-Match. Returns false on transport errors. */
bool tm_http_get(uint32_t ip, int port, const char *path, const char *if_none_match,
                 uint64_t deadline_ms, tm_http_result *out, char *err, size_t errlen);

/* Small HTTP/1.0 POST (used to upload TM Sync's log to the Mac). True on HTTP 200. */
bool tm_http_post(uint32_t ip, int port, const char *path, const uint8_t *body, uint32_t body_len,
                  uint64_t deadline_ms, int *out_status);

#endif
