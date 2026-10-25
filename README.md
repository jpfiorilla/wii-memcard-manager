# Wii Memcard Manager

Keeps a **Training Mode CE** memory card on a real Wii stocked with the recordings you want to practice.
Export `.gci` recordings from TM:CE to a folder; the next time the Wii starts **TM Sync**, it pulls the
updated card over Wi-Fi and boots TM:CE.

Two programs, released together with one version number:

- **Wii Memcard Manager** (Mac menu bar app) watches your `.gci` folder, builds `GTME.raw` (the game's
  save + up to 25 recordings chosen by a playlist: Latest, Latest of each, Shuffle, per-matchup, or
  custom), and serves it on your network.
- **TM Sync** (Wii, Homebrew Channel) downloads that card if it changed, then boots regular Nintendont.
  Press **START** to skip the sync. The Mac app installs it for you.

![How a recording gets to the Wii](docs/data-flow.svg)

## Set up

1. Download `Wii Memcard Manager_<version>.zip` from the
   [latest release](https://github.com/jpfiorilla/wii-memcard-manager/releases/latest) and move the app
   to Applications. It's unsigned: if macOS says it's damaged, run
   `xattr -cr "/Applications/Wii Memcard Manager.app"`.
2. Choose your `.gci` folder in the app.
3. Put the Wii's SD card in the Mac once. The app installs TM Sync, points it at this Mac and copies
   the card (`tm-sync-<version>.zip` on the release is for manual installs).
4. On the Wii, launch TM:CE once from **regular** Nintendont (Slippi Nintendont has no memory card
   emulation), then start **TM Sync** from the Homebrew Channel from then on.

Logs: menu bar → Open Log (`~/Library/Logs/Wii Memcard Manager/`; TM Sync's log is uploaded there too).

## Develop

```bash
npm install
npm run dev
npm run fetch:tm-sync   # latest CI build of TM Sync (needs gh); building it locally needs devkitPPC
npm run build
```

TM Sync's source and docs are in [`tm-sync/`](tm-sync/README.md).

To release, bump the version in `package.json`, `tm-sync/source/version.h` and `tm-sync/meta.xml`,
then push a `v<version>` tag. CI builds both and attaches them to the release.

## License

MIT. The memory card code in `electron/main/gcmemcard/` follows Dolphin's `GCMemcard` (GPLv2+);
any part ported directly from Dolphin falls under GPLv2+.
