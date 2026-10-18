# Wii Memcard Manager

Keeps a **Training Mode CE** memory card on a real Wii stocked with your newest recordings.
Record a situation in TM:CE, export the `.gci` to a folder (e.g. Google Drive), and the next time the
Wii starts **TM Sync** it downloads the updated card over Wi-Fi and boots TM:CE.

It's two programs released together, always with the same version number:

- **Wii Memcard Manager** (Mac, menu bar): watches your `.gci` folder, builds `GTME.raw`
  (Nintendont's 251-block size, the game's own save + your newest 25 recordings), and serves it on
  your home network.
- **TM Sync** (Wii, Homebrew Channel): fetches that card before booting regular Nintendont.
  It's bundled inside the Mac app; you don't download it separately.

![How a recording gets to the Wii](docs/data-flow.svg)

## Set up

1. Download `Wii Memcard Manager_<version>.zip` from the latest
   [release](https://github.com/jpfiorilla/wii-memcard-manager/releases), move the app to
   Applications and open it (see the Gatekeeper note below). It lives in the menu bar and starts at login.
2. In the app, choose your `.gci` folder and turn on watching.
3. Put the Wii's SD card (the one with Nintendont) into the Mac once. The app installs TM Sync on it,
   points it at this Mac, and copies the current card. Allow incoming connections if macOS asks.
4. On the Wii, launch TM:CE once from **regular** Nintendont (Slippi Nintendont has no memory card
   emulation) so it's the last-played game. From then on, start **TM Sync** from the Homebrew Channel.

Plugging the SD card into the Mac again later updates TM Sync to match the app and refreshes the
Mac's address if it changed. The SD-ready `tm-sync-<version>.zip` is also attached to each release
for manual installs.

Logs: `~/Library/Logs/Wii Memcard Manager/manager.log` (Mac) and `wii-tmsync.log` next to it
(TM Sync uploads its own log after each run that reaches the Mac). Menu bar → Open Log.

## Develop

Agent-oriented cheat sheet: [`.cursor/rules/wii-memcard-manager-brief.mdc`](.cursor/rules/wii-memcard-manager-brief.mdc).

```bash
npm install
npm run dev
```

## Build

TM Sync needs devkitPPC, so local builds use the latest CI build of it:

```bash
npm run fetch:tm-sync   # needs the GitHub CLI (gh); or: make -C tm-sync package
npm run build           # bundles TM Sync into the app; versions must match package.json
```

Releases: bump `package.json`, `tm-sync/source/version.h` and `tm-sync/meta.xml` together, then push
a `v<version>` tag. The release workflow builds TM Sync, bundles it into the Mac/Windows builds, and
attaches everything to the GitHub release.

## macOS: “damaged and can’t be opened”

Releases are **not** signed with an Apple Developer ID or notarized. macOS Gatekeeper may show that message for downloaded apps; it usually means **quarantine / unsigned**, not a bad download.

- **Remove quarantine** (after copying the app to Applications):

  ```bash
  xattr -cr "/Applications/Wii Memcard Manager.app"
  ```

- Or open **System Settings → Privacy & Security** and use **Open Anyway** when the app is blocked.
- Or **right-click** the app → **Open** → confirm once.

CI builds run an **ad-hoc** `codesign` step to reduce this; seamless installs without extra steps require **Developer ID signing + notarization** (paid Apple Developer account).

## Stack

- Electron, Vite, React, TypeScript
- MUI + Emotion, notistack
- chokidar (main process) for live folder updates

## License

MIT (boilerplate). If you embed Dolphin `GCMemcard` code, that portion is GPLv2+ — plan compliance before shipping merged logic.
