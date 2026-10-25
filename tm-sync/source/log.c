#include "log.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

#include "netio.h"

#define LOG_ROTATE_BYTES (256u * 1024u)

static char s_path[256];
static uint64_t s_t0;

void tm_log_open(const char *path)
{
	snprintf(s_path, sizeof(s_path), "%s", path);
	s_t0 = tm_now_ms();
	struct stat st;
	if (stat(s_path, &st) == 0 && (size_t)st.st_size > LOG_ROTATE_BYTES) {
		char old[sizeof(s_path) + 4];
		snprintf(old, sizeof(old), "%s.1", s_path);
		remove(old);
		rename(s_path, old);
	}
}

const char *tm_log_path(void)
{
	return s_path;
}

void tm_log(const char *fmt, ...)
{
	if (!s_path[0]) return;
	FILE *f = fopen(s_path, "a");
	if (!f) return;
	uint64_t ms = tm_now_ms() - s_t0;
	fprintf(f, "[%4u.%03u] ", (unsigned)(ms / 1000), (unsigned)(ms % 1000));
	va_list ap;
	va_start(ap, fmt);
	vfprintf(f, fmt, ap);
	va_end(ap);
	fputc('\n', f);
	fclose(f);
}

uint8_t *tm_log_tail(size_t max, size_t *out_len)
{
	*out_len = 0;
	if (!s_path[0]) return NULL;
	FILE *f = fopen(s_path, "rb");
	if (!f) return NULL;
	fseek(f, 0, SEEK_END);
	long size = ftell(f);
	if (size <= 0) { fclose(f); return NULL; }
	size_t n = (size_t)size > max ? max : (size_t)size;
	fseek(f, size - (long)n, SEEK_SET);
	uint8_t *buf = malloc(n);
	if (buf && fread(buf, 1, n, f) != n) { free(buf); buf = NULL; }
	fclose(f);
	if (buf) *out_len = n;
	return buf;
}
