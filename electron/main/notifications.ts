import { Notification } from 'electron'
import { readUserSettings } from './userSettings'

/** OS Notification Center only; never plays a sound. Respects `notificationsEnabled` in user settings. */
export async function showMemcardNotification(title: string, body: string) {
  const s = await readUserSettings()
  if (!s.notificationsEnabled) return
  if (!Notification.isSupported()) return
  try {
    new Notification({
      title: 'Wii Memcard Manager',
      subtitle: title,
      body,
      silent: true,
    }).show()
  } catch {
    try {
      new Notification({
        title: `${title} — Wii Memcard Manager`,
        body,
        silent: true,
      }).show()
    } catch {
      /* ignore */
    }
  }
}
