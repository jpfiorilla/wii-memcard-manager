#ifndef TMSYNC_DOLBOOT_H
#define TMSYNC_DOLBOOT_H
#include <stddef.h>
#include <stdint.h>

/*
 * Validate a DOL image against what we can safely overwrite. Our own code is linked
 * high in MEM1 (TMSYNC_LOAD_ADDR) so a normal DOL (Nintendont's loader lives at
 * 0x80004000+) can be copied into place underneath us. Returns 0 if OK.
 */
int dol_validate(const uint8_t *dol, size_t len, char *err, size_t errlen);

/*
 * Copy the DOL into place and jump to it, passing argv the same way the Homebrew
 * Channel does: argv[0] = `argv0`, argv[1] = `arg1` (binary, may contain NULs —
 * that's how loaders hand Nintendont its NIN_CFG). Only returns on validation error.
 * Callers must shut down WPAD/network/FAT first.
 */
int dol_boot(const uint8_t *dol, size_t len, const char *argv0, const void *arg1, size_t arg1_len);

#endif
