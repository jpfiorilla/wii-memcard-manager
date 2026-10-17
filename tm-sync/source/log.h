#ifndef TMSYNC_LOG_H
#define TMSYNC_LOG_H
#include <stddef.h>
#include <stdint.h>

/* Debug log on the SD card (e.g. sd:/apps/tm-sync/tmsync.log). Every line is appended and the
 * file closed again right away, so a crash or power cut never loses what was already logged.
 * Rotates to tmsync.log.1 at 256 KB. The tail is also uploaded to the Mac after each run that
 * reaches it, where it lands in ~/Library/Logs/Wii Memcard Manager/wii-tmsync.log. */
void tm_log_open(const char *path);
void tm_log(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
const char *tm_log_path(void);
/* Last `max` bytes of the log file (malloc'd, caller frees), or NULL. */
uint8_t *tm_log_tail(size_t max, size_t *out_len);

#endif
