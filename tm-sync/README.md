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

You normally don't install this by hand: put the Wii's SD card into the Mac running Wii Memcard
Manager and the app installs (or updates) `sd:/apps/tm-sync/` and writes its own address into
`config.ini`. TM Sync's version always matches the app's; it sends it as `User-Agent: tm-sync/<version>`
and the app logs a warning if they differ.

Manual install: unzip `tm-sync-<version>.zip` from the release onto the SD card.

Then launch TM:CE once from regular Nintendont (so it's the last-played game) and start
**TM Sync** from the Homebrew Channel from then on (or make it the Homebrew Channel / Priiloader autoboot).
It boots the last game you played in Nintendont (from `sd:/nincfg.bin`).

## Controls

- **A** — launch now
- **HOME / START** — back to the Homebrew Channel
- **Hold B** while it starts — skip the sync

## config.ini

`sd:/apps/tm-sync/config.ini`. `host=`/`port=` are filled in by the Mac app whenever the SD card is
plugged into it; TM Sync asks that address directly over HTTP. If it can't reach it (the Mac's address
changed), it searches the network over UDP 8643, and remembers what it finds in `last_mac.txt`.
`timeout=` (default 40 s) covers Wi-Fi bring-up (retried, since the Wii's Wi-Fi is flaky) and the download.
`nintendont=` / `nincfg=` blank auto-detect `apps/Nintendont/boot.dol` + `nincfg.bin` (falling back to Slippi Nintendont + `slippi_nincfg.bin`).

## Build

Needs devkitPPC (libogc + libfat): `make` → `tm-sync.dol`, `make package` → `dist/apps/tm-sync/`.
The app links itself at `0x81200000` so it can copy Nintendont's loader into low MEM1 and jump to it,
passing `slippi_nincfg.bin` (with auto-boot set) as `argv[1]` like USB Loader GX / WiiFlow do.
