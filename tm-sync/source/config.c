#include "config.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void config_defaults(tmsync_config *c)
{
	memset(c, 0, sizeof(*c));
	c->port = 8642;
	strcpy(c->game, "GTME");
	strcpy(c->saves_dir, "sd:/saves");
	c->launch = true;
	c->autoboot = true;
	c->timeout_s = 5;
	c->keep_backups = 5;
	c->pause_ms = 800;
}

static char *trim(char *s)
{
	while (*s && isspace((unsigned char)*s)) s++;
	char *e = s + strlen(s);
	while (e > s && isspace((unsigned char)e[-1])) *--e = '\0';
	return s;
}

static bool parse_bool(const char *v)
{
	return !strcmp(v, "1") || !strcasecmp(v, "true") || !strcasecmp(v, "yes") || !strcasecmp(v, "on");
}

static void copy_str(char *dst, size_t cap, const char *src)
{
	snprintf(dst, cap, "%s", src);
	/* strip a single trailing slash on directories */
	size_t n = strlen(dst);
	if (n > 1 && dst[n - 1] == '/' && dst[n - 2] != ':') dst[n - 1] = '\0';
}

bool config_load(const char *path, tmsync_config *c)
{
	FILE *f = fopen(path, "r");
	if (!f) return false;
	char line[512];
	while (fgets(line, sizeof(line), f)) {
		char *hash = strpbrk(line, "#;");
		if (hash) *hash = '\0';
		char *eq = strchr(line, '=');
		if (!eq) continue;
		*eq = '\0';
		char *k = trim(line), *v = trim(eq + 1);
		size_t vl = strlen(v);
		if (vl >= 2 && v[0] == '"' && v[vl - 1] == '"') { v[vl - 1] = '\0'; v++; }

		if (!strcasecmp(k, "host")) copy_str(c->host, sizeof(c->host), v);
		else if (!strcasecmp(k, "port")) { int p = atoi(v); if (p > 0 && p < 65536) c->port = p; }
		else if (!strcasecmp(k, "game")) {
			if (strlen(v) == 4) { strcpy(c->game, v); for (char *p = c->game; *p; p++) *p = toupper((unsigned char)*p); }
		}
		else if (!strcasecmp(k, "saves_dir")) copy_str(c->saves_dir, sizeof(c->saves_dir), v);
		else if (!strcasecmp(k, "nintendont")) copy_str(c->nintendont, sizeof(c->nintendont), v);
		else if (!strcasecmp(k, "nincfg")) copy_str(c->nincfg, sizeof(c->nincfg), v);
		else if (!strcasecmp(k, "launch")) c->launch = parse_bool(v);
		else if (!strcasecmp(k, "autoboot")) c->autoboot = parse_bool(v);
		else if (!strcasecmp(k, "timeout")) { int t = atoi(v); if (t >= 1 && t <= 60) c->timeout_s = t; }
		else if (!strcasecmp(k, "keep_backups")) { int n = atoi(v); if (n >= 0 && n <= 100) c->keep_backups = n; }
		else if (!strcasecmp(k, "pause_ms")) { int n = atoi(v); if (n >= 0 && n <= 30000) c->pause_ms = n; }
	}
	fclose(f);
	return true;
}

bool config_write_default(const char *path)
{
	FILE *f = fopen(path, "w");
	if (!f) return false;
	fputs(
		"# TM Sync settings. Lines starting with # are comments.\n"
		"\n"
		"# The Mac running Wii Memcard Manager. Leave blank to find it automatically.\n"
		"host=\n"
		"port=8642\n"
		"\n"
		"# Memory card to sync (TM:CE = GTME) and where Nintendont keeps it.\n"
		"game=GTME\n"
		"saves_dir=sd:/saves\n"
		"\n"
		"# After syncing, start Slippi Nintendont. Blank paths = auto-detect.\n"
		"launch=1\n"
		"autoboot=1\n"
		"nintendont=\n"
		"nincfg=\n"
		"\n"
		"# Seconds to spend on Wi-Fi + download before giving up and booting normally.\n"
		"timeout=5\n"
		"keep_backups=5\n"
		"pause_ms=800\n",
		f);
	fclose(f);
	return true;
}
