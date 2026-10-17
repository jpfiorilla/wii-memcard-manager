/**
 * Persistent log for the background app: ~/Library/Logs/Wii Memcard Manager/manager.log on macOS
 * (app.getPath('logs')). Everything printed with console.* in the main process lands here too, so
 * folder builds, organizing, SD copies and every Wii sync request can be reviewed after the fact.
 * Rotates to manager.log.1 at ~2 MB.
 */
import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import { app } from 'electron'

const MAX_BYTES = 2 * 1024 * 1024
let logFile: string | null = null

export function logFilePath(): string {
  if (!logFile) {
    const dir = app.getPath('logs')
    fs.mkdirSync(dir, { recursive: true })
    logFile = path.join(dir, 'manager.log')
  }
  return logFile
}

function stamp(): string {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function write(level: string, args: unknown[]) {
  try {
    const file = logFilePath()
    try {
      if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.1`)
    } catch {
      /* no file yet */
    }
    const text = args.map((a) => (typeof a === 'string' ? a : util.inspect(a, { depth: 4, breakLength: 200 }))).join(' ')
    fs.appendFileSync(file, `${stamp()} ${level} ${text}\n`)
  } catch {
    /* logging must never break the app */
  }
}

export const log = {
  info: (...args: unknown[]) => write('INFO ', args),
  warn: (...args: unknown[]) => write('WARN ', args),
  error: (...args: unknown[]) => write('ERROR', args),
}

/** Mirror console.log/warn/error from the main process into the log file. */
export function installConsoleLogging() {
  const orig = { log: console.log, warn: console.warn, error: console.error }
  console.log = (...a: unknown[]) => {
    orig.log(...a)
    log.info(...a)
  }
  console.warn = (...a: unknown[]) => {
    orig.warn(...a)
    log.warn(...a)
  }
  console.error = (...a: unknown[]) => {
    orig.error(...a)
    log.error(...a)
  }
  process.on('uncaughtException', (e) => log.error('uncaughtException', e))
  process.on('unhandledRejection', (e) => log.error('unhandledRejection', e))
}
