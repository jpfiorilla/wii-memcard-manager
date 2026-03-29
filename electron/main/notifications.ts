import { Notification } from 'electron'

export function showMemcardNotification(title: string, body: string) {
  if (!Notification.isSupported()) return
  try {
    new Notification({
      title: 'Wii Memcard Manager',
      subtitle: title,
      body,
    }).show()
  } catch {
    try {
      new Notification({ title: `${title} — Wii Memcard Manager`, body }).show()
    } catch {
      /* ignore */
    }
  }
}
