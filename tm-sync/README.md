# TM Sync (Wii app)

Homebrew Channel app that pulls the newest Training Mode card (`GTME.raw`) from
Wii Memcard Manager on your Mac, then boots Nintendont straight into it.

Use **regular Nintendont** (`apps/Nintendont`) for TM:CE: Slippi Nintendont disables memory card
emulation, so it never reads `saves/GTME.raw`. TM Sync prefers regular Nintendont and `nincfg.bin`,
turns on auto-boot (bit 7 there, bit 10 in Slippi's fork), forces per-game memory card emulation on
and multi-card mode off so the synced card is the one that loads.

- **Only downloads when it changed.** The Mac tags each built card with an ETag (CRC32 + size).
  The Wii stores the tag it last pulled in `sd:/apps/tm-sync/GTME.etag` and sends it back;
  an unchanged card gets `304 Not Modified` and nothing is written to the SD card.
- **Fails quietly.** Anything other than a good, checksum-verified new card (no Wi-Fi, Mac asleep,
  app closed, 304, 404, timeout) boots exactly as normal with the save already on the SD card.
- **Safe writes.** The new card is written to `GTME.raw.tmp` and renamed into place; the
  previous card goes to `sd:/saves/backups/GTME-YYYYMMDD-HHMMSS.raw` (newest 5 kept).

## Install

1. Download `tm-sync.zip` from the GitHub release (or the *TM Sync* workflow artifact) and
   unzip it onto the SD card so you have `sd:/apps/tm-sync/boot.dol`.
2. On the Mac, keep Wii Memcard Manager open with **Serve staged images to the Wii** on
   (Settings → Wii TM Sync). Allow incoming connections if macOS asks.
3. Launch TM:CE once from regular Nintendont (from the SD card) so it becomes the last-played game.
4. Launch **TM Sync** from the Homebrew Channel instead of Nintendont.
   To make it automatic, set it as the Homebrew Channel / Priiloader autoboot.

It boots the last game you played in Nintendont (from `sd:/nincfg.bin`).

## Controls

- **A** — launch now
- **HOME / START** — back to the Homebrew Channel
- **Hold B** while it starts — skip the sync

## config.ini

Created on first run at `sd:/apps/tm-sync/config.ini`. Defaults work for most setups:
`host=` blank auto-discovers the Mac (UDP 8643); set `host=<Mac IP>` if discovery doesn't reach it.
`nintendont=` / `nincfg=` blank auto-detect `apps/Nintendont/boot.dol` + `nincfg.bin` (falling back to Slippi Nintendont + `slippi_nincfg.bin`).

## Build

Needs devkitPPC (libogc + libfat): `make` → `tm-sync.dol`, `make package` → `dist/apps/tm-sync/`.
The app links itself at `0x81200000` so it can copy Nintendont's loader into low MEM1 and jump to it,
passing `slippi_nincfg.bin` (with auto-boot set) as `argv[1]` like USB Loader GX / WiiFlow do.
