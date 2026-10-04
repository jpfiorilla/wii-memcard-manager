#ifndef TMSYNC_CONFIG_H
#define TMSYNC_CONFIG_H
#include <stdbool.h>

#define TMSYNC_PATH_MAX 256

typedef struct {
	char host[64];          /* blank = auto-discover the Mac over UDP broadcast */
	int port;               /* Wii Memcard Manager HTTP port (default 8642) */
	char game[8];           /* memory card file stem, e.g. GTME */
	char saves_dir[TMSYNC_PATH_MAX];  /* where Nintendont reads <game>.raw, e.g. sd:/saves */
	char nintendont[TMSYNC_PATH_MAX]; /* boot.dol to chain-load; blank = auto-detect */
	char nincfg[TMSYNC_PATH_MAX];     /* Slippi Nintendont's saved settings; blank = auto-detect */
	bool launch;            /* chain-load Nintendont after syncing */
	bool autoboot;          /* boot the last-played game directly (skip Nintendont's menu) */
	int timeout_s;          /* network budget (Wi-Fi bring-up + discovery + download) */
	int keep_backups;       /* how many previous <game>.raw copies to keep in saves/backups */
	int pause_ms;           /* how long the status screen stays up before launching */
} tmsync_config;

void config_defaults(tmsync_config *c);
/* Returns true if the file existed. Unknown keys are ignored. */
bool config_load(const char *path, tmsync_config *c);
/* Writes a commented default config (used on first run). */
bool config_write_default(const char *path);

#endif
