# Golden fixtures (immutable)

Files in this directory are **reference binaries** for tests and regression checks. **Do not edit or regenerate them** unless you are deliberately replacing the golden baseline (e.g. new hardware capture).

## `GTME.raw`

- **Origin:** Nintendont / Wii — TM:CE created a new default save; this is that memory card image as captured from the SD layout (`saves/GTME.raw` style).
- **Purpose:** Canonical `.raw` for load checks, byte-identical round-trip (`MemcardImage.load` → `toBuffer()`), and SHA-256 fingerprint. Any import/mutation tests must use **copies** in memory or temp files, never this path written in place.

When updating this file (rare), update the expected SHA-256 in `test/golden-gtme.test.ts` and document why in the commit message.
