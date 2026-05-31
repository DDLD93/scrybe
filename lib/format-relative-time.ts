export function formatSavedAgo(date: Date, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}
