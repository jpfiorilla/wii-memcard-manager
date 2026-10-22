#include "dolboot.h"

#include <stdio.h>
#include <string.h>

#include <gccore.h>
#include <ogc/machine/processor.h>

#ifndef TMSYNC_LOAD_ADDR
#error "TMSYNC_LOAD_ADDR must match the .init section address in the Makefile"
#endif

/* Same spot USB Loader GX / WiiFlow's app booter use for the command line. */
#define ARGS_ADDR ((uint8_t *)0x93300800)
#define MEM1_LOW  0x80003100u

typedef struct {
	uint32_t text_off[7];
	uint32_t data_off[11];
	uint32_t text_addr[7];
	uint32_t data_addr[11];
	uint32_t text_size[7];
	uint32_t data_size[11];
	uint32_t bss_addr;
	uint32_t bss_size;
	uint32_t entry;
	uint8_t pad[0x1C];
} __attribute__((packed)) dol_header;

_Static_assert(sizeof(dol_header) == 0x100, "DOL header must be 0x100 bytes");

static int range_ok(uint32_t addr, uint32_t size)
{
	if (size == 0) return 1;
	if (addr < MEM1_LOW) return 0;
	if ((uint64_t)addr + size > TMSYNC_LOAD_ADDR) return 0;
	return 1;
}

int dol_validate(const uint8_t *dol, size_t len, char *err, size_t errlen)
{
	if (len < sizeof(dol_header)) { snprintf(err, errlen, "not a DOL (too small)"); return -1; }
	const dol_header *h = (const dol_header *)dol;
	int entry_ok = 0;
	for (int i = 0; i < 7; i++) {
		if (!h->text_size[i]) continue;
		if ((uint64_t)h->text_off[i] + h->text_size[i] > len) { snprintf(err, errlen, "DOL text %d truncated", i); return -1; }
		if (!range_ok(h->text_addr[i], h->text_size[i])) {
			snprintf(err, errlen, "DOL text %d at %08x would overwrite tm-sync", i, (unsigned)h->text_addr[i]);
			return -1;
		}
		if (h->entry >= h->text_addr[i] && h->entry + 12 + sizeof(struct __argv) <= h->text_addr[i] + h->text_size[i])
			entry_ok = 1;
	}
	for (int i = 0; i < 11; i++) {
		if (!h->data_size[i]) continue;
		if ((uint64_t)h->data_off[i] + h->data_size[i] > len) { snprintf(err, errlen, "DOL data %d truncated", i); return -1; }
		if (!range_ok(h->data_addr[i], h->data_size[i])) {
			snprintf(err, errlen, "DOL data %d at %08x would overwrite tm-sync", i, (unsigned)h->data_addr[i]);
			return -1;
		}
	}
	if (!range_ok(h->bss_addr, h->bss_size)) { snprintf(err, errlen, "DOL bss would overwrite tm-sync"); return -1; }
	if (!entry_ok) { snprintf(err, errlen, "DOL entry point %08x is not in a text section", (unsigned)h->entry); return -1; }
	return 0;
}

/* Lives in our .bss (high MEM1), so it can't collide with the DOL buffer or ARGS_ADDR. */
static uint8_t s_cmdline[4096] __attribute__((aligned(32)));

int dol_boot(const uint8_t *dol, size_t len, const char *argv0, const void *arg1, size_t arg1_len)
{
	char err[96];
	if (dol_validate(dol, len, err, sizeof(err)) != 0) return -1;

	size_t a0 = strlen(argv0) + 1;
	if (a0 + arg1_len + 1 > sizeof(s_cmdline)) return -2;
	memset(s_cmdline, 0, sizeof(s_cmdline));
	memcpy(s_cmdline, argv0, a0);
	if (arg1 && arg1_len) memcpy(s_cmdline + a0, arg1, arg1_len);
	size_t cmd_len = a0 + arg1_len + 1; /* trailing NUL terminates the last arg */

	const dol_header *h = (const dol_header *)dol;

	SYS_ResetSystem(SYS_SHUTDOWN, 0, 0);
	u32 level;
	_CPU_ISR_Disable(level);
	(void)level;

	if (h->bss_size) {
		memset((void *)h->bss_addr, 0, h->bss_size);
		DCFlushRange((void *)h->bss_addr, h->bss_size);
	}
	for (int i = 0; i < 7; i++) {
		if (!h->text_size[i]) continue;
		memmove((void *)h->text_addr[i], dol + h->text_off[i], h->text_size[i]);
		DCFlushRange((void *)h->text_addr[i], h->text_size[i]);
		ICInvalidateRange((void *)h->text_addr[i], h->text_size[i]);
	}
	for (int i = 0; i < 11; i++) {
		if (!h->data_size[i]) continue;
		memmove((void *)h->data_addr[i], dol + h->data_off[i], h->data_size[i]);
		DCFlushRange((void *)h->data_addr[i], h->data_size[i]);
	}

	memcpy(ARGS_ADDR, s_cmdline, cmd_len);
	DCFlushRange(ARGS_ADDR, (cmd_len + 31) & ~31u);

	/* libogc's crt0 starts with `b startup; .long ARGV_MAGIC; struct __argv` — fill it in. */
	uint32_t *entry = (uint32_t *)h->entry;
	if (entry[1] == ARGV_MAGIC) {
		struct __argv args;
		memset(&args, 0, sizeof(args));
		args.argvMagic = ARGV_MAGIC;
		args.commandLine = (char *)ARGS_ADDR;
		args.length = (int)cmd_len;
		memcpy(&entry[2], &args, sizeof(args));
		DCFlushRange(&entry[2], sizeof(args));
		ICInvalidateRange(&entry[2], sizeof(args));
	}

	void (*start)(void) = (void (*)(void))h->entry;
	start();
	for (;;) {}
}
