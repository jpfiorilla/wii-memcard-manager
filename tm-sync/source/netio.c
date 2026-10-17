#include "netio.h"
#include "log.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <unistd.h>

#include <gccore.h>
#include <network.h>
#include <ogc/lwp_watchdog.h>

#ifndef POLLIN
#define POLLIN 0x0001
#endif

#define MAX_RESPONSE (8u * 1024u * 1024u)

uint64_t tm_now_ms(void)
{
	return ticks_to_millisecs(gettime());
}

static int remaining_ms(uint64_t deadline)
{
	uint64_t now = tm_now_ms();
	return now >= deadline ? 0 : (int)(deadline - now);
}

/* ---------------------------------------------------------------- bring-up */

static volatile int s_init_done;
static volatile s32 s_init_result;

static s32 init_cb(s32 result, void *usr)
{
	(void)usr;
	s_init_result = result;
	s_init_done = 1;
	return 0;
}

/* One net_init_async attempt; 0 = up, <0 = IOS error, 1 = ran out of time (already deinit'd). */
static int net_up_once(uint64_t deadline_ms, int attempt)
{
	s_init_done = 0;
	s_init_result = -1;
	uint64_t t0 = tm_now_ms();
	tm_log("net: attempt %d: net_init_async (budget %d ms)", attempt, remaining_ms(deadline_ms));
	s32 r = net_init_async(init_cb, NULL);
	if (r < 0) {
		tm_log("net: net_init_async returned %d", (int)r);
		return (int)r;
	}
	uint64_t next_tick = t0 + 2000;
	while (!s_init_done) {
		if (remaining_ms(deadline_ms) == 0) {
			tm_log("net: still not up after %u ms - giving up", (unsigned)(tm_now_ms() - t0));
			net_deinit(); /* aborts the pending async init */
			return 1;
		}
		if (tm_now_ms() >= next_tick) {
			tm_log("net: waiting... %u ms", (unsigned)(tm_now_ms() - t0));
			next_tick += 2000;
		}
		usleep(20 * 1000);
	}
	tm_log("net: attempt %d finished in %u ms, result %d", attempt, (unsigned)(tm_now_ms() - t0), (int)s_init_result);
	return s_init_result < 0 ? (int)s_init_result : 0;
}

bool tm_net_up(uint64_t deadline_ms, char *err, size_t errlen)
{
	/* The Wii's Wi-Fi bring-up is flaky: most runs connect in ~7 s, but some fail with -116
	 * (timed out) after ~20 s. A second try usually works, so keep retrying while time remains. */
	uint64_t t0 = tm_now_ms();
	int last = 0;
	for (int attempt = 1; attempt <= 4; attempt++) {
		last = net_up_once(deadline_ms, attempt);
		if (last == 0) {
			char ip[20];
			tm_format_ipv4(tm_local_ip(), ip, sizeof(ip));
			tm_log("net: up after %u ms (attempt %d), local ip %s", (unsigned)(tm_now_ms() - t0), attempt, ip);
			return true;
		}
		if (last == 1) break; /* out of time */
		net_deinit();
		if (remaining_ms(deadline_ms) < 5000) break;
		tm_log("net: retrying in 1 s");
		usleep(1000 * 1000);
	}
	if (last == 1)
		snprintf(err, errlen, "Wi-Fi didn't come up in %u s (raise timeout= in config.ini)",
			(unsigned)((tm_now_ms() - t0 + 500) / 1000));
	else
		snprintf(err, errlen, "Wi-Fi connect failed (%d) - check the Wii's Internet settings", last);
	return false;
}

void tm_net_down(void)
{
	net_deinit();
}

uint32_t tm_local_ip(void)
{
	return ntohl(net_gethostip());
}

/* ---------------------------------------------------------------- helpers */

bool tm_parse_ipv4(const char *s, uint32_t *out)
{
	unsigned a, b, c, d;
	char tail;
	if (sscanf(s, "%u.%u.%u.%u%c", &a, &b, &c, &d, &tail) != 4) return false;
	if (a > 255 || b > 255 || c > 255 || d > 255) return false;
	*out = (a << 24) | (b << 16) | (c << 8) | d;
	return true;
}

void tm_format_ipv4(uint32_t ip, char *buf, size_t len)
{
	snprintf(buf, len, "%u.%u.%u.%u", (ip >> 24) & 255, (ip >> 16) & 255, (ip >> 8) & 255, ip & 255);
}

static void make_addr(struct sockaddr_in *sa, uint32_t ip, int port)
{
	memset(sa, 0, sizeof(*sa));
	/* The Wii's IOS socket layer uses an 8-byte sockaddr (len, family, port, addr) and rejects
	 * anything else with -22: sendto failed with sin_len 0 (1.1.1) and 16 (1.1.2). */
	sa->sin_len = 8;
	sa->sin_family = AF_INET;
	sa->sin_port = htons((u16)port);
	sa->sin_addr.s_addr = htonl(ip);
}

static bool wait_readable(s32 sock, int timeout_ms)
{
	struct pollsd p = { .socket = sock, .events = POLLIN, .revents = 0 };
	s32 r = net_poll(&p, 1, timeout_ms);
	return r > 0 && (p.revents & POLLIN);
}

/* ---------------------------------------------------------------- discovery */

bool tm_discover(uint32_t hint_ip, uint64_t deadline_ms, uint32_t *out_ip, int *out_port)
{
	/* The Wii's IOS network stack rejects IPPROTO_UDP here (-123, protocol not supported); 0 picks UDP. */
	s32 sock = net_socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
	if (sock < 0) {
		tm_log("discover: socket() failed (%d)", (int)sock);
		return false;
	}
	uint64_t t0 = tm_now_ms();

	u32 yes = 1;
	net_setsockopt(sock, SOL_SOCKET, SO_BROADCAST, &yes, sizeof(yes)); /* best effort */

	struct sockaddr_in any;
	make_addr(&any, 0, 0);
	s32 br = net_bind(sock, (struct sockaddr *)&any, 8);
	tm_log("discover: bind=%d", (int)br);

	static const char probe[] = "TMSYNC_DISCOVER 1\n";
	uint32_t local = tm_local_ip();
	uint32_t targets[3];
	int n = 0;
	if (hint_ip) targets[n++] = hint_ip;
	targets[n++] = 0xFFFFFFFFu;                        /* limited broadcast */
	if (local) targets[n++] = (local & 0xFFFFFF00u) | 0xFFu; /* /24 directed broadcast */

	bool found = false;
	int attempt = 0;
	while (!found && remaining_ms(deadline_ms) > 0) {
		for (int i = 0; i < n; i++) {
			if (hint_ip && i > 0 && attempt == 0) continue; /* try the configured host alone first */
			struct sockaddr_in to;
			make_addr(&to, targets[i], TMSYNC_DISCOVERY_PORT);
			s32 sr = net_sendto(sock, probe, sizeof(probe) - 1, 0, (struct sockaddr *)&to, 8);
			char tb[20];
			tm_format_ipv4(targets[i], tb, sizeof(tb));
			tm_log("discover: attempt %d -> %s:%d sendto=%d", attempt + 1, tb, TMSYNC_DISCOVERY_PORT, (int)sr);
		}
		attempt++;

		uint64_t round_end = tm_now_ms() + 500;
		if (round_end > deadline_ms) round_end = deadline_ms;
		while (remaining_ms(round_end) > 0) {
			if (!wait_readable(sock, remaining_ms(round_end))) break;
			char buf[64];
			struct sockaddr_in from;
			socklen_t fl = sizeof(from);
			s32 got = net_recvfrom(sock, buf, sizeof(buf) - 1, 0, (struct sockaddr *)&from, &fl);
			if (got <= 0) continue;
			buf[got] = '\0';
			char fb[20];
			tm_format_ipv4(ntohl(from.sin_addr.s_addr), fb, sizeof(fb));
			tm_log("discover: reply from %s: \"%.40s\"", fb, buf);
			int ver = 0, port = 0;
			if (sscanf(buf, "TMSYNC_HERE %d %d", &ver, &port) == 2 && port > 0 && port < 65536) {
				*out_ip = ntohl(from.sin_addr.s_addr);
				*out_port = port;
				found = true;
				break;
			}
		}
	}
	net_close(sock);
	tm_log("discover: %s after %d attempt(s), %u ms", found ? "found the Mac" : "no reply",
		attempt, (unsigned)(tm_now_ms() - t0));
	return found;
}

/* ---------------------------------------------------------------- HTTP */

static const char *find_header(const char *headers, const char *name, char *val, size_t vlen)
{
	size_t nl = strlen(name);
	const char *p = headers;
	while ((p = strstr(p, "\r\n")) != NULL) {
		p += 2;
		if (!strncasecmp(p, name, nl) && p[nl] == ':') {
			const char *v = p + nl + 1;
			while (*v == ' ' || *v == '\t') v++;
			const char *e = strstr(v, "\r\n");
			size_t len = e ? (size_t)(e - v) : strlen(v);
			if (len >= vlen) len = vlen - 1;
			memcpy(val, v, len);
			val[len] = '\0';
			return val;
		}
	}
	return NULL;
}

bool tm_http_get(uint32_t ip, int port, const char *path, const char *if_none_match,
                 uint64_t deadline_ms, tm_http_result *out, char *err, size_t errlen)
{
	memset(out, 0, sizeof(*out));
	uint64_t t0 = tm_now_ms();
	tm_log("http: GET %s (If-None-Match: %s, budget %d ms)", path,
		if_none_match && *if_none_match ? if_none_match : "-", remaining_ms(deadline_ms));

	s32 sock = net_socket(AF_INET, SOCK_STREAM, IPPROTO_IP);
	if (sock < 0) {
		snprintf(err, errlen, "socket() failed (%d)", (int)sock);
		return false;
	}
	struct sockaddr_in sa;
	make_addr(&sa, ip, port);
	s32 r = net_connect(sock, (struct sockaddr *)&sa, sizeof(sa));
	tm_log("http: connect=%d after %u ms", (int)r, (unsigned)(tm_now_ms() - t0));
	if (r < 0) {
		snprintf(err, errlen, "couldn't connect to the Mac (%d)", (int)r);
		net_close(sock);
		return false;
	}

	char ipbuf[20], req[512];
	tm_format_ipv4(ip, ipbuf, sizeof(ipbuf));
	int reqlen = snprintf(req, sizeof(req),
		"GET %s HTTP/1.0\r\n"
		"Host: %s:%d\r\n"
		"User-Agent: tm-sync/1\r\n"
		"%s%s%s"
		"Connection: close\r\n\r\n",
		path, ipbuf, port,
		if_none_match && *if_none_match ? "If-None-Match: " : "",
		if_none_match && *if_none_match ? if_none_match : "",
		if_none_match && *if_none_match ? "\r\n" : "");
	for (int sent = 0; sent < reqlen;) {
		s32 w = net_send(sock, req + sent, reqlen - sent, 0);
		if (w <= 0) {
			snprintf(err, errlen, "send failed (%d)", (int)w);
			net_close(sock);
			return false;
		}
		sent += w;
	}

	uint32_t cap = 64 * 1024, len = 0;
	uint8_t *buf = malloc(cap + 1);
	if (!buf) { net_close(sock); snprintf(err, errlen, "out of memory"); return false; }

	uint32_t header_end = 0;  /* offset of body start once known */
	int64_t content_length = -1;
	bool ok = true;

	for (;;) {
		int left = remaining_ms(deadline_ms);
		if (left == 0) { snprintf(err, errlen, "download timed out"); ok = false; break; }
		if (!wait_readable(sock, left)) { snprintf(err, errlen, "download timed out"); ok = false; break; }
		if (len == cap) {
			if (cap >= MAX_RESPONSE) { snprintf(err, errlen, "response too large"); ok = false; break; }
			cap *= 2;
			uint8_t *nb = realloc(buf, cap + 1);
			if (!nb) { snprintf(err, errlen, "out of memory"); ok = false; break; }
			buf = nb;
		}
		s32 got = net_recv(sock, buf + len, cap - len, 0);
		if (got == 0) break; /* server closed: complete */
		if (got < 0) {
			if (got == -EAGAIN) continue;
			snprintf(err, errlen, "receive failed (%d)", (int)got);
			ok = false;
			break;
		}
		len += (uint32_t)got;

		if (!header_end) {
			buf[len] = '\0';
			char *he = strstr((char *)buf, "\r\n\r\n");
			if (he) {
				header_end = (uint32_t)(he - (char *)buf) + 4;
				char v[32];
				*he = '\0';
				if (find_header((char *)buf, "Content-Length", v, sizeof(v))) content_length = atoll(v);
				*he = '\r';
				if (content_length > (int64_t)MAX_RESPONSE) { snprintf(err, errlen, "response too large"); ok = false; break; }
				/* grow once to the exact final size */
				if (content_length >= 0 && header_end + (uint32_t)content_length > cap) {
					cap = header_end + (uint32_t)content_length;
					uint8_t *nb = realloc(buf, cap + 1);
					if (!nb) { snprintf(err, errlen, "out of memory"); ok = false; break; }
					buf = nb;
				}
			}
		}
		if (header_end && content_length >= 0 && len >= header_end + (uint32_t)content_length) break;
	}
	net_close(sock);
	tm_log("http: received %u bytes in %u ms (ok=%d%s%s)", len, (unsigned)(tm_now_ms() - t0), ok,
		ok ? "" : ", ", ok ? "" : err);

	if (ok && !header_end) { snprintf(err, errlen, "bad HTTP response"); ok = false; }
	if (!ok) { free(buf); return false; }

	buf[header_end - 2] = '\0'; /* terminate header block (keeps the last \r\n) */
	int major = 0, minor = 0, status = 0;
	if (sscanf((char *)buf, "HTTP/%d.%d %d", &major, &minor, &status) != 3) {
		free(buf);
		snprintf(err, errlen, "bad HTTP status line");
		return false;
	}
	out->status = status;
	find_header((char *)buf, "ETag", out->etag, sizeof(out->etag));
	tm_log("http: status %d, content-length %lld, etag %s", status, (long long)content_length,
		out->etag[0] ? out->etag : "-");
	char crc[16];
	if (find_header((char *)buf, "X-TMSync-CRC32", crc, sizeof(crc))) {
		out->crc = (uint32_t)strtoul(crc, NULL, 16);
		out->has_crc = true;
	}

	uint32_t body_len = len - header_end;
	if (content_length >= 0) {
		if (body_len < (uint32_t)content_length) {
			free(buf);
			snprintf(err, errlen, "download cut short (%u of %u bytes)", body_len, (unsigned)content_length);
			return false;
		}
		body_len = (uint32_t)content_length;
	}
	if (status == 200 && body_len > 0) {
		out->body = malloc(body_len);
		if (!out->body) { free(buf); snprintf(err, errlen, "out of memory"); return false; }
		memcpy(out->body, buf + header_end, body_len);
		out->body_len = body_len;
	}
	free(buf);
	return true;
}

bool tm_http_post(uint32_t ip, int port, const char *path, const uint8_t *body, uint32_t body_len,
                  uint64_t deadline_ms, int *out_status)
{
	*out_status = 0;
	s32 sock = net_socket(AF_INET, SOCK_STREAM, IPPROTO_IP);
	if (sock < 0) return false;
	struct sockaddr_in sa;
	make_addr(&sa, ip, port);
	if (net_connect(sock, (struct sockaddr *)&sa, sizeof(sa)) < 0) {
		net_close(sock);
		return false;
	}
	char ipbuf[20], hdr[256];
	tm_format_ipv4(ip, ipbuf, sizeof(ipbuf));
	int hl = snprintf(hdr, sizeof(hdr),
		"POST %s HTTP/1.0\r\nHost: %s:%d\r\nUser-Agent: tm-sync/1\r\n"
		"Content-Type: text/plain\r\nContent-Length: %u\r\nConnection: close\r\n\r\n",
		path, ipbuf, port, (unsigned)body_len);
	const uint8_t *parts[2] = { (const uint8_t *)hdr, body };
	uint32_t lens[2] = { (uint32_t)hl, body_len };
	for (int p = 0; p < 2; p++) {
		for (uint32_t sent = 0; sent < lens[p];) {
			if (remaining_ms(deadline_ms) == 0) { net_close(sock); return false; }
			uint32_t chunk = lens[p] - sent > 8192 ? 8192 : lens[p] - sent;
			s32 w = net_send(sock, parts[p] + sent, chunk, 0);
			if (w <= 0) { net_close(sock); return false; }
			sent += (uint32_t)w;
		}
	}
	char resp[64] = "";
	if (wait_readable(sock, remaining_ms(deadline_ms))) {
		s32 got = net_recv(sock, resp, sizeof(resp) - 1, 0);
		if (got > 0) {
			resp[got] = '\0';
			int a, b;
			sscanf(resp, "HTTP/%d.%d %d", &a, &b, out_status);
		}
	}
	net_close(sock);
	return *out_status == 200;
}
