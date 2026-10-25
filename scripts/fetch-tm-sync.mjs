#!/usr/bin/env node
/**
 * Local builds can't compile TM Sync (it needs devkitPPC), so fetch the latest CI build of it for
 * the current git branch into tm-sync/dist. Requires the GitHub CLI (gh), logged in.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = 'jpfiorilla/wii-memcard-manager'
const sh = (cmd, args, opts = {}) => (execFileSync(cmd, args, { encoding: 'utf-8', cwd: root, ...opts }) ?? '').trim()

const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
const runId = sh('gh', [
  'run', 'list', '-R', repo, '-w', 'tm-sync.yml', '-b', branch, '-s', 'success', '-L', '1',
  '--json', 'databaseId', '-q', '.[0].databaseId',
])
if (!runId) {
  console.error(`fetch-tm-sync: no successful TM Sync build for branch ${branch} yet (push, then wait for CI)`)
  process.exit(1)
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-sync-'))
sh('gh', ['run', 'download', '-R', repo, runId, '-n', 'tm-sync', '-D', tmp], { stdio: 'inherit' })
const dist = path.join(root, 'tm-sync/dist')
fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })
sh('unzip', ['-o', '-q', path.join(tmp, 'tm-sync.zip'), '-d', dist])
console.log(`fetch-tm-sync: run ${runId} -> ${path.join(dist, 'apps/tm-sync')}`)
