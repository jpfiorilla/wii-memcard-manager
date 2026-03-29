# Wii Memcard Manager

Electron + React desktop app for managing GameCube **`.gci`** files and **`.raw`** memory card images for **real Wiis** (Nintendont `saves/GTME.raw`, `GALE.raw`, etc.).

## Status

Early scaffold: folder watching (Drive / export folders), pick target `.raw`, **backup-before-write** to a `backups/` directory next to the card file. **GCMemcard merge/import logic** is not implemented yet (planned: port or call GPL Dolphin-derived code).

Agent-oriented cheat sheet (always-on Cursor rule): [`.cursor/rules/wii-memcard-manager-brief.mdc`](.cursor/rules/wii-memcard-manager-brief.mdc).

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Stack

- Electron, Vite, React, TypeScript
- MUI + Emotion, notistack
- chokidar (main process) for live folder updates

## License

MIT (boilerplate). If you embed Dolphin `GCMemcard` code, that portion is GPLv2+ — plan compliance before shipping merged logic.
