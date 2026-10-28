/** Format signed seconds as "+h:mm" or "−h:mm:ss". */
export function formatDuration(
  seconds: number,
  opts: { signed?: boolean; showSeconds?: boolean } = {},
): string {
  const { signed = true, showSeconds = false } = opts;
  const abs = Math.abs(Math.trunc(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const body = showSeconds ? `${h}:${pad(m)}:${pad(s)}` : `${h}:${pad(m)}`;
  if (!signed) return body;
  return (seconds < 0 ? "−" : "+") + body;
}

/** Human label for a preset, e.g. "+15 min", "−1 h 30 min". */
export function presetLabel(seconds: number): string {
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.round((abs % 3600) / 60);
  const parts = [h ? `${h} h` : "", m || !h ? `${m} min` : ""].filter(Boolean);
  return (seconds < 0 ? "−" : "+") + parts.join(" ");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Epoch ms → value for <input type="datetime-local" step="1"> in local time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Parse a datetime-local value (local time); NaN if invalid. */
export function fromLocalInput(value: string): number {
  return value ? new Date(value).getTime() : NaN;
}

export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
