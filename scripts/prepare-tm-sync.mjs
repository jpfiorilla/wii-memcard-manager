#!/usr/bin/env node
/**
 * Runs before electron-builder. The Mac app ships TM Sync (the Wii half) inside it and installs it
 * onto Wii SD cards, so the two can never drift apart. This script:
 *   1. checks TM Sync's version (tm-sync/source/version.h, tm-sync/meta.xml) matches package.json
 *   2. copies the built TM Sync (tm-sync/dist/apps/tm-sync, from `make -C tm-sync package` or
 *      `npm run fetch:tm-sync`) into build/tm-sync-bundle, which electron-builder ships as
 *      Resources/tm-sync.
 * In CI both are hard requirements; locally a missing build is a warning (the app then just
 * doesn't install TM Sync onto SD cards).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ci = Boolean(process.env.CI)
const fail = (msg) => {
  if (ci) {
    console.error(`prepare-tm-sync: ${msg}`)
    process.exit(1)
  }
  console.warn(`prepare-tm-sync: WARNING: ${msg}`)
}

const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')).version
const header = fs.readFileSync(path.join(root, 'tm-sync/source/version.h'), 'utf-8')
const meta = fs.readFileSync(path.join(root, 'tm-sync/meta.xml'), 'utf-8')
const cVersion = /TMSYNC_VERSION\s+"([^"]+)"/.exec(header)?.[1]
const metaVersion = /<version>([^<]+)<\/version>/.exec(meta)?.[1]
if (cVersion !== appVersion || metaVersion !== appVersion) {
  fail(`version mismatch: package.json ${appVersion}, version.h ${cVersion}, meta.xml ${metaVersion}`)
}

const src = process.env.TM_SYNC_DIST || path.join(root, 'tm-sync/dist/apps/tm-sync')
const out = path.join(root, 'build/tm-sync-bundle')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
if (!fs.existsSync(path.join(src, 'boot.dol'))) {
  fail(`no TM Sync build at ${src} (run: npm run fetch:tm-sync)`)
} else {
  for (const f of ['boot.dol', 'meta.xml', 'config.ini']) fs.copyFileSync(path.join(src, f), path.join(out, f))
  const builtVersion = /<version>([^<]+)<\/version>/.exec(fs.readFileSync(path.join(out, 'meta.xml'), 'utf-8'))?.[1]
  if (builtVersion !== appVersion) fail(`TM Sync build at ${src} is ${builtVersion}, app is ${appVersion}`)
  console.log(`prepare-tm-sync: bundling TM Sync ${builtVersion} from ${src}`)
}
