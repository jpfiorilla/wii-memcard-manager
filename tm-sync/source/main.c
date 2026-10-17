/*
 * TM Sync — pulls the newest Training Mode memory card (GTME.raw) from Wii Memcard
 * Manager on your Mac, writes it where Nintendont reads it (saves/<GAME>.raw), then boots
 * Nintendont straight into the last-played game. Regular Nintendont is preferred: Slippi
 * Nintendont disables memory card emulation, so it never reads the synced card.
 *
 * Only downloads when the Mac has a different card than the one we last pulled
 * (ETag = CRC32 + size, sent back as If-None-Match). Anything other than a good,
 * checksum-verified 200 (no Wi-Fi, Mac asleep, 304, 404, timeout...) boots exactly
 * as normal with whatever save is already on the SD card, with no extra delay.
 *
 * Buttons on the status screen: A = launch now, HOME/START = exit to the Homebrew Channel.
 * Hold B while TM Sync starts to skip the network step.
 */
#include <dirent.h>
#include <errno.h>
#include <malloc.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#include <fat.h>
#include <gccore.h>
#include <wiiuse/wpad.h>

#include "config.h"
#include "crc32.h"
#include "dolboot.h"
#include "log.h"
#include "netio.h"

#define TMSYNC_VERSION "1.0.0"

/* NIN_CFG fields we touch (see project-slippi/Nintendont common/include/CommonConfig.h). */
#define NIN_MAGIC 0x01070CF6u
#define NIN_CFG_OFF_CONFIG 8
#define NIN_CFG_OFF_GAMEPATH 20
/* Config bits differ between the two Nintendonts:
 *   regular Nintendont (FIX94): MEMCARDEMU = bit 3, AUTO_BOOT = bit 7, MC_MULTI = bit 13 (bit 10 is USB!)
 *   Slippi Nintendont:          AUTO_BOOT = bit 10, memory card emulation disabled entirely
 * TM:CE saves only work through regular Nintendont's per-game emulated card (saves/GTME.raw). */
#define NIN_CFG_AUTO_BOOT_SLIPPI  (1u << 10)
#define NIN_CFG_AUTO_BOOT_REGULAR (1u << 7)
#define NIN_CFG_MEMCARDEMU_REGULAR (1u << 3)
#define NIN_CFG_MC_MULTI_REGULAR  (1u << 13)

static void *xfb;
static GXRModeObj *rmode;

/* ------------------------------------------------------------------ console */

static void video_init(void)
{
	VIDEO_Init();
	rmode = VIDEO_GetPreferredMode(NULL);
	xfb = MEM_K0_TO_K1(SYS_AllocateFramebuffer(rmode));
	console_init(xfb, 20, 20, rmode->fbWidth, rmode->xfbHeight, rmode->fbWidth * VI_DISPLAY_PIX_SZ);
	VIDEO_Configure(rmode);
	VIDEO_SetNextFramebuffer(xfb);
	VIDEO_SetBlack(false);
	VIDEO_Flush();
	VIDEO_WaitVSync();
	if (rmode->viTVMode & VI_NON_INTERLACE) VIDEO_WaitVSync();
}

/* Print a status line on screen and record it in the SD log. */
static void say(const char *fmt, ...)
{
	char line[256];
	va_list ap;
	va_start(ap, fmt);
	vsnprintf(line, sizeof(line), fmt, ap);
	va_end(ap);
	printf("%s\n", line);
	if (line[0]) tm_log("screen: %s", line);
	VIDEO_WaitVSync();
}

static const char *outcome_name(int o);

enum { BTN_NONE, BTN_LAUNCH, BTN_EXIT, BTN_SKIP };

static int poll_buttons(void)
{
	WPAD_ScanPads();
	PAD_ScanPads();
	u32 w = WPAD_ButtonsHeld(0);
	u16 g = PAD_ButtonsHeld(0);
	if ((w & (WPAD_BUTTON_HOME | WPAD_CLASSIC_BUTTON_HOME)) || (g & PAD_BUTTON_START)) return BTN_EXIT;
	if ((w & (WPAD_BUTTON_A | WPAD_CLASSIC_BUTTON_A)) || (g & PAD_BUTTON_A)) return BTN_LAUNCH;
	if ((w & (WPAD_BUTTON_B | WPAD_CLASSIC_BUTTON_B)) || (g & PAD_BUTTON_B)) return BTN_SKIP;
	return BTN_NONE;
}

/* Wait up to ms; returns early on A (launch) or HOME/START (exit). */
static int pause_for(int ms)
{
	uint64_t end = tm_now_ms() + (uint64_t)ms;
	while (tm_now_ms() < end) {
		int b = poll_buttons();
		if (b == BTN_LAUNCH || b == BTN_EXIT) return b;
		VIDEO_WaitVSync();
	}
	return BTN_NONE;
}

/* ------------------------------------------------------------------ files */

static bool file_exists(const char *p)
{
	struct stat st;
	return stat(p, &st) == 0 && S_ISREG(st.st_mode);
}

static uint8_t *read_file(const char *path, size_t *out_len)
{
	FILE *f = fopen(path, "rb");
	if (!f) return NULL;
	fseek(f, 0, SEEK_END);
	long n = ftell(f);
	fseek(f, 0, SEEK_SET);
	if (n <= 0) { fclose(f); return NULL; }
	uint8_t *buf = memalign(32, (size_t)n);
	if (buf && fread(buf, 1, (size_t)n, f) != (size_t)n) { free(buf); buf = NULL; }
	fclose(f);
	if (buf) *out_len = (size_t)n;
	return buf;
}

static bool write_file(const char *path, const void *data, size_t len)
{
	FILE *f = fopen(path, "wb");
	if (!f) return false;
	bool ok = fwrite(data, 1, len, f) == len;
	ok = (fclose(f) == 0) && ok;
	return ok;
}

static void read_line_file(const char *path, char *out, size_t cap)
{
	out[0] = '\0';
	FILE *f = fopen(path, "r");
	if (!f) return;
	if (fgets(out, (int)cap, f)) out[strcspn(out, "\r\n")] = '\0';
	fclose(f);
}

static void mkdirs(const char *dir)
{
	char tmp[TMSYNC_PATH_MAX];
	snprintf(tmp, sizeof(tmp), "%s", dir);
	for (char *p = strchr(tmp, '/'); p; p = strchr(p + 1, '/')) {
		if (p > tmp && p[-1] == ':') continue; /* skip "sd:/" */
		*p = '\0';
		mkdir(tmp, 0777);
		*p = '/';
	}
	mkdir(tmp, 0777);
}

static int cmp_str(const void *a, const void *b)
{
	return strcmp(*(const char *const *)a, *(const char *const *)b);
}

/* Keep only the newest `keep` backups named <game>-YYYYMMDD-HHMMSS.raw. */
static void prune_backups(const char *dir, const char *game, int keep)
{
	DIR *d = opendir(dir);
	if (!d) return;
	char *names[256];
	int n = 0;
	size_t gl = strlen(game);
	struct dirent *e;
	while ((e = readdir(d)) != NULL && n < 256) {
		size_t l = strlen(e->d_name);
		if (l > gl + 5 && !strncasecmp(e->d_name, game, gl) && e->d_name[gl] == '-' && !strcasecmp(e->d_name + l - 4, ".raw"))
			names[n++] = strdup(e->d_name);
	}
	closedir(d);
	qsort(names, n, sizeof(char *), cmp_str);
	for (int i = 0; i < n; i++) {
		if (i < n - keep) {
			char p[TMSYNC_PATH_MAX * 2];
			snprintf(p, sizeof(p), "%s/%s", dir, names[i]);
			remove(p);
		}
		free(names[i]);
	}
}

/* ------------------------------------------------------------------ sync */

typedef enum { SYNC_SKIPPED, SYNC_UP_TO_DATE, SYNC_UPDATED, SYNC_NOTHING_STAGED, SYNC_FAILED } sync_outcome;

static bool g_net_up;
static uint32_t g_mac_ip;
static int g_mac_port;

static sync_outcome do_sync_inner(const tmsync_config *cfg, const char *app_dir)
{
	char save_path[TMSYNC_PATH_MAX + 16], tmp_path[TMSYNC_PATH_MAX + 20], etag_path[TMSYNC_PATH_MAX + 16];
	snprintf(save_path, sizeof(save_path), "%s/%s.raw", cfg->saves_dir, cfg->game);
	snprintf(tmp_path, sizeof(tmp_path), "%s.tmp", save_path);
	snprintf(etag_path, sizeof(etag_path), "%s/%s.etag", app_dir, cfg->game);

	/* Recover from a power cut between "remove old" and "rename new". */
	if (!file_exists(save_path) && file_exists(tmp_path)) rename(tmp_path, save_path);

	char last_etag[96] = "";
	bool have_local = file_exists(save_path);
	if (have_local) read_line_file(etag_path, last_etag, sizeof(last_etag));
	{
		struct stat st;
		tm_log("sync: card %s exists=%d size=%ld last_etag=%s", save_path, have_local,
			have_local && stat(save_path, &st) == 0 ? (long)st.st_size : -1L, last_etag[0] ? last_etag : "-");
	}

	uint64_t deadline = tm_now_ms() + (uint64_t)cfg->timeout_s * 1000;
	char err[128] = "";

	say("Connecting to Wi-Fi...");
	if (!tm_net_up(deadline, err, sizeof(err))) {
		say("  %s", err);
		return SYNC_FAILED;
	}
	g_net_up = true;
	char ipbuf[20];
	tm_format_ipv4(tm_local_ip(), ipbuf, sizeof(ipbuf));
	say("  Wii is %s", ipbuf);

	uint32_t hint = 0;
	if (cfg->host[0] && !tm_parse_ipv4(cfg->host, &hint)) {
		say("  host=%s isn't an IPv4 address; searching instead", cfg->host);
		hint = 0;
	}
	char last_mac_path[TMSYNC_PATH_MAX + 16];
	snprintf(last_mac_path, sizeof(last_mac_path), "%s/last_mac.txt", app_dir);
	if (!hint) {
		char last[40] = "";
		read_line_file(last_mac_path, last, sizeof(last));
		char *sp = strchr(last, ' ');
		if (sp) *sp = '\0';
		if (last[0] && tm_parse_ipv4(last, &hint)) tm_log("discover: trying last known Mac %s first", last);
		else hint = 0;
	}
	if (cfg->host[0] && hint) say("Contacting %s...", cfg->host);
	else say("Looking for Wii Memcard Manager on your network...");
	uint32_t mac_ip = 0;
	int mac_port = cfg->port;
	uint64_t disc_deadline = tm_now_ms() + 2500;
	if (disc_deadline > deadline) disc_deadline = deadline;
	bool direct = hint != 0;
	if (direct) {
		/* Known address (host= or last time): go straight to HTTP, no UDP needed. */
		mac_ip = hint;
		tm_log("discover: skipping broadcast, asking %s:%d directly", cfg->host[0] ? cfg->host : "last known Mac", mac_port);
	} else if (!tm_discover(0, disc_deadline, &mac_ip, &mac_port)) {
		/* Mac off / app closed: don't risk a slow TCP connect, just boot. */
		say("  Mac not found - booting with the save already on the SD card.");
		say("  (Is Wii Memcard Manager running on the Mac, on the same network?)");
		return SYNC_FAILED;
	}
	g_mac_ip = mac_ip;
	g_mac_port = mac_port;
	tm_format_ipv4(mac_ip, ipbuf, sizeof(ipbuf));
	{
		/* Remember the Mac so the next run can ask it directly first (in case broadcasts get dropped). */
		char line[40];
		int n = snprintf(line, sizeof(line), "%s %d\n", ipbuf, mac_port);
		write_file(last_mac_path, line, (size_t)n);
	}
	say("  Mac is %s:%d", ipbuf, mac_port);

	char url[64];
	snprintf(url, sizeof(url), "/tmsync/v1/saves/%s.raw", cfg->game);
	tm_http_result res;
	bool ok = tm_http_get(mac_ip, mac_port, url, have_local ? last_etag : NULL, deadline, &res, err, sizeof(err));
	if (!ok && direct) {
		/* The Mac may have a new address: fall back to searching for it once. */
		tm_log("sync: direct request failed (%s); searching instead", err);
		uint64_t d2 = tm_now_ms() + 2500;
		if (d2 > deadline) d2 = deadline;
		if (tm_discover(0, d2, &mac_ip, &mac_port)) {
			g_mac_ip = mac_ip;
			g_mac_port = mac_port;
			tm_format_ipv4(mac_ip, ipbuf, sizeof(ipbuf));
			say("  Mac is now %s:%d", ipbuf, mac_port);
			ok = tm_http_get(mac_ip, mac_port, url, have_local ? last_etag : NULL, deadline, &res, err, sizeof(err));
		}
	}
	if (!ok) {
		say("  %s", err);
		return SYNC_FAILED;
	}

	if (res.status == 304) {
		say("%s.raw is already up to date.", cfg->game);
		return SYNC_UP_TO_DATE;
	}
	if (res.status == 404) {
		say("The Mac hasn't built a %s.raw yet - keeping the SD card's copy.", cfg->game);
		return SYNC_NOTHING_STAGED;
	}
	if (res.status != 200 || !res.body) {
		say("  Unexpected reply from the Mac (HTTP %d)", res.status);
		free(res.body);
		return SYNC_FAILED;
	}

	uint32_t crc = crc32_buf(res.body, res.body_len);
	tm_log("sync: got %u bytes, crc %08x (server says %s%08x)", (unsigned)res.body_len, (unsigned)crc,
		res.has_crc ? "" : "nothing / ", (unsigned)res.crc);
	if (res.has_crc && crc != res.crc) {
		say("  Checksum mismatch (got %08x, expected %08x) - not writing.", (unsigned)crc, (unsigned)res.crc);
		free(res.body);
		return SYNC_FAILED;
	}

	/* Identical bytes already on the SD card? Just remember the tag. */
	if (have_local) {
		size_t cur_len = 0;
		uint8_t *cur = read_file(save_path, &cur_len);
		bool same = cur && cur_len == res.body_len && crc32_buf(cur, cur_len) == crc;
		free(cur);
		if (same) {
			write_file(etag_path, res.etag, strlen(res.etag));
			free(res.body);
			say("%s.raw is already up to date.", cfg->game);
			return SYNC_UP_TO_DATE;
		}
	}

	say("Writing new %s.raw (%u KB)...", cfg->game, (unsigned)(res.body_len / 1024));
	mkdirs(cfg->saves_dir);
	if (!write_file(tmp_path, res.body, res.body_len)) {
		tm_log("sync: write %s failed, errno %d", tmp_path, errno);
		say("  Couldn't write %s", tmp_path);
		remove(tmp_path);
		free(res.body);
		return SYNC_FAILED;
	}
	free(res.body);

	if (have_local && cfg->keep_backups > 0) {
		char bdir[TMSYNC_PATH_MAX + 16], bpath[TMSYNC_PATH_MAX * 2];
		snprintf(bdir, sizeof(bdir), "%s/backups", cfg->saves_dir);
		mkdirs(bdir);
		time_t t = time(NULL);
		struct tm *lt = localtime(&t);
		snprintf(bpath, sizeof(bpath), "%s/%s-%04d%02d%02d-%02d%02d%02d.raw", bdir, cfg->game,
			lt->tm_year + 1900, lt->tm_mon + 1, lt->tm_mday, lt->tm_hour, lt->tm_min, lt->tm_sec);
		if (rename(save_path, bpath) == 0) {
			tm_log("sync: backup %s", bpath);
			say("  Previous card saved to backups/");
			prune_backups(bdir, cfg->game, cfg->keep_backups);
		} else {
			tm_log("sync: backup rename to %s failed, errno %d", bpath, errno);
		}
	}
	if (file_exists(save_path)) remove(save_path);
	if (rename(tmp_path, save_path) != 0) {
		say("  Couldn't move the new card into place (%d)", errno);
		return SYNC_FAILED;
	}
	write_file(etag_path, res.etag, strlen(res.etag));
	tm_log("sync: installed new card, etag %s saved to %s", res.etag, etag_path);
	say("Updated %s", save_path);
	return SYNC_UPDATED;
}

static const char *outcome_name(int o)
{
	switch (o) {
	case SYNC_SKIPPED: return "skipped";
	case SYNC_UP_TO_DATE: return "up to date";
	case SYNC_UPDATED: return "updated";
	case SYNC_NOTHING_STAGED: return "nothing staged on the Mac";
	default: return "failed";
	}
}

/* Runs the sync, then (if the Mac was reached) uploads the log tail so it can be read on the Mac. */
static sync_outcome do_sync(const tmsync_config *cfg, const char *app_dir)
{
	g_net_up = false;
	g_mac_ip = 0;
	uint64_t t0 = tm_now_ms();
	sync_outcome o = do_sync_inner(cfg, app_dir);
	tm_log("sync: outcome = %s (%u ms)", outcome_name(o), (unsigned)(tm_now_ms() - t0));
	if (g_net_up && g_mac_ip) {
		size_t n = 0;
		uint8_t *tail = tm_log_tail(48 * 1024, &n);
		int status = 0;
		bool sent = tail && tm_http_post(g_mac_ip, g_mac_port, "/tmsync/v1/log", tail, (uint32_t)n,
			tm_now_ms() + 3000, &status);
		tm_log("sync: log upload %s (%u bytes, HTTP %d)", sent ? "ok" : "failed", (unsigned)n, status);
		free(tail);
	}
	if (g_net_up) tm_net_down();
	if (o == SYNC_FAILED) say("  Details: %s", tm_log_path());
	return o;
}

/* ------------------------------------------------------------------ launch */

static const char *find_first(const char *configured, const char *const *candidates, char *out, size_t cap)
{
	if (configured[0]) {
		if (file_exists(configured)) { snprintf(out, cap, "%s", configured); return out; }
		return NULL;
	}
	for (int i = 0; candidates[i]; i++)
		if (file_exists(candidates[i])) { snprintf(out, cap, "%s", candidates[i]); return out; }
	return NULL;
}

static void shutdown_for_launch(void)
{
	WPAD_Shutdown();
	fatUnmount("sd:");
	fatUnmount("usb:");
}

static bool contains_ci(const char *hay, const char *needle)
{
	size_t n = strlen(needle);
	for (; *hay; hay++)
		if (!strncasecmp(hay, needle, n)) return true;
	return false;
}

static void launch_nintendont(const tmsync_config *cfg)
{
	static const char *const dols[] = {
		/* Regular Nintendont first: TM:CE needs its emulated memory card. */
		"sd:/apps/Nintendont/boot.dol", "sd:/apps/nintendont/boot.dol",
		"sd:/apps/Slippi Nintendont/boot.dol", "sd:/apps/slippi-nintendont/boot.dol",
		"sd:/apps/SlippiNintendont/boot.dol", "sd:/apps/slippi/boot.dol",
		"usb:/apps/Slippi Nintendont/boot.dol", "usb:/apps/slippi-nintendont/boot.dol", NULL,
	};
	static const char *const cfgs_regular[] = { "sd:/nincfg.bin", "usb:/nincfg.bin", NULL };
	static const char *const cfgs_slippi[] = { "sd:/slippi_nincfg.bin", "usb:/slippi_nincfg.bin", NULL };

	char dol_path[TMSYNC_PATH_MAX], cfg_path[TMSYNC_PATH_MAX];
	tm_log("launch: nintendont=%s autoboot=%d", cfg->nintendont[0] ? cfg->nintendont : "(auto)", cfg->autoboot);
	if (!find_first(cfg->nintendont, dols, dol_path, sizeof(dol_path))) {
		say("Couldn't find Nintendont's boot.dol.");
		say("Set nintendont= in config.ini. Returning to the Homebrew Channel...");
		pause_for(5000);
		return;
	}

	size_t dol_len = 0;
	uint8_t *dol = read_file(dol_path, &dol_len);
	char err[96];
	tm_log("launch: dol %s (%u bytes)", dol_path, (unsigned)dol_len);
	if (!dol || dol_validate(dol, dol_len, err, sizeof(err)) != 0) {
		say("Can't launch %s: %s", dol_path, dol ? err : "read failed");
		free(dol);
		pause_for(5000);
		return;
	}

	size_t ncfg_len = 0;
	uint8_t *ncfg = NULL;
	bool slippi = contains_ci(dol_path, "slippi");
	if (cfg->autoboot && find_first(cfg->nincfg, slippi ? cfgs_slippi : cfgs_regular, cfg_path, sizeof(cfg_path))) {
		ncfg = read_file(cfg_path, &ncfg_len);
		uint32_t magic = ncfg && ncfg_len > NIN_CFG_OFF_GAMEPATH + 1 ? *(uint32_t *)ncfg : 0;
		tm_log("launch: cfg %s (%u bytes) magic %08x slippi=%d", cfg_path, (unsigned)ncfg_len, (unsigned)magic, slippi);
		if (magic != NIN_MAGIC || ncfg[NIN_CFG_OFF_GAMEPATH] == '\0') {
			say("%s has no last-played game; opening Nintendont's menu.", cfg_path);
			free(ncfg);
			ncfg = NULL;
			ncfg_len = 0;
		} else {
			uint32_t *conf = (uint32_t *)(ncfg + NIN_CFG_OFF_CONFIG);
			if (slippi) {
				*conf |= NIN_CFG_AUTO_BOOT_SLIPPI;
			} else {
				/* Auto-boot, and make sure the per-game card (saves/<GAME>.raw) is what loads. */
				*conf |= NIN_CFG_AUTO_BOOT_REGULAR | NIN_CFG_MEMCARDEMU_REGULAR;
				*conf &= ~NIN_CFG_MC_MULTI_REGULAR;
			}
			tm_log("launch: config bits %08x, game %s", (unsigned)*conf, (char *)ncfg + NIN_CFG_OFF_GAMEPATH);
			say("Booting %s", (char *)ncfg + NIN_CFG_OFF_GAMEPATH);
		}
	}

	say("Starting %s ...", dol_path);
	VIDEO_WaitVSync();
	shutdown_for_launch();
	dol_boot(dol, dol_len, dol_path, ncfg, ncfg_len);
	/* only reached if validation failed (already checked above) */
	free(dol);
	free(ncfg);
}

/* ------------------------------------------------------------------ main */

int main(int argc, char **argv)
{
	video_init();
	WPAD_Init();
	PAD_Init();

	printf("\x1b[2;0H");
	say("TM Sync %s - Training Mode save sync for Nintendont", TMSYNC_VERSION);
	say("");

	if (!fatInitDefault()) {
		say("Couldn't open the SD card.");
		pause_for(5000);
		return 0;
	}

	/* argv[0] is e.g. "sd:/apps/tm-sync/boot.dol" when launched from the HBC. */
	char app_dir[TMSYNC_PATH_MAX] = "sd:/apps/tm-sync";
	if (argc > 0 && argv && argv[0] && strchr(argv[0], ':')) {
		snprintf(app_dir, sizeof(app_dir), "%s", argv[0]);
		char *slash = strrchr(app_dir, '/');
		if (slash) *slash = '\0';
	}

	char log_path[TMSYNC_PATH_MAX + 16];
	snprintf(log_path, sizeof(log_path), "%s/tmsync.log", app_dir);
	tm_log_open(log_path);
	{
		time_t t = time(NULL);
		struct tm *lt = localtime(&t);
		tm_log("==== TM Sync %s run %04d-%02d-%02d %02d:%02d:%02d ====", TMSYNC_VERSION,
			lt->tm_year + 1900, lt->tm_mon + 1, lt->tm_mday, lt->tm_hour, lt->tm_min, lt->tm_sec);
		tm_log("argv0=%s app_dir=%s video=%ux%u", argc > 0 && argv && argv[0] ? argv[0] : "-", app_dir,
			rmode->fbWidth, rmode->xfbHeight);
	}

	tmsync_config cfg;
	config_defaults(&cfg);
	char cfg_path[TMSYNC_PATH_MAX + 16];
	snprintf(cfg_path, sizeof(cfg_path), "%s/config.ini", app_dir);
	bool had_cfg = config_load(cfg_path, &cfg);
	if (!had_cfg) config_write_default(cfg_path);
	tm_log("config (%s%s): host=%s port=%d game=%s saves_dir=%s nintendont=%s nincfg=%s launch=%d autoboot=%d "
		"timeout=%ds keep_backups=%d pause_ms=%d", cfg_path, had_cfg ? "" : ", defaults written",
		cfg.host[0] ? cfg.host : "(discover)", cfg.port, cfg.game, cfg.saves_dir,
		cfg.nintendont[0] ? cfg.nintendont : "(auto)", cfg.nincfg[0] ? cfg.nincfg : "(auto)",
		cfg.launch, cfg.autoboot, cfg.timeout_s, cfg.keep_backups, cfg.pause_ms);

	bool skip = poll_buttons() == BTN_SKIP;
	sync_outcome r = skip ? SYNC_SKIPPED : do_sync(&cfg, app_dir);
	if (skip) say("B held - skipping sync.");

	if (!cfg.launch) {
		say("");
		say("launch=0 - press HOME to return to the Homebrew Channel.");
		while (poll_buttons() != BTN_EXIT) VIDEO_WaitVSync();
		return 0;
	}

	say("");
	say("A: launch now   HOME/START: back to Homebrew Channel");
	/* Failures never cost extra time: anything but a good new card just boots as normal. */
	(void)r;
	int b = pause_for(cfg.pause_ms);
	if (b == BTN_EXIT) {
		tm_log("exit to Homebrew Channel (button)");
		return 0;
	}

	launch_nintendont(&cfg);
	return 0;
}
