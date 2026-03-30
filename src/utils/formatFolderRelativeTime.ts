/** Local calendar-day difference: 0 = same day, 1 = yesterday, etc. */
function calendarDaysBeforeNow(ms: number, nowMs: number): number {
  const now = new Date(nowMs);
  const d = new Date(ms);
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startFile = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  return Math.round((startToday - startFile) / (24 * 60 * 60 * 1000));
}

function formatTimeLowercase(ms: number): string {
  const d = new Date(ms);
  return d
    .toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s*([AP]M)$/i, (_, ap: string) => ap.toLowerCase());
}

/**
 * e.g. "Today at 2:25pm", "Yesterday at 9:10am", "5 days ago at 3:00pm".
 * Uses file modified time (`mtimeMs`).
 */
export function formatFolderRelativeTime(
  mtimeMs: number,
  nowMs: number = Date.now(),
): string {
  const time = formatTimeLowercase(mtimeMs);
  const days = calendarDaysBeforeNow(mtimeMs, nowMs);

  if (days < 0) {
    const d = new Date(mtimeMs);
    return `${d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== new Date(nowMs).getFullYear()
        ? "numeric"
        : undefined,
    })} at ${time}`;
  }
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  return `${days} days ago at ${time}`;
}
