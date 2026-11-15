import { useEffect, useRef, useState } from "preact/hooks";
import { remindersDue } from "../logic";
import type { ActiveTimer, Settings } from "../model";

/** Current time, refreshed every `intervalMs` (or only on visibility change if null). */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    document.addEventListener("visibilitychange", tick);
    const id = intervalMs === null ? undefined : setInterval(tick, intervalMs);
    return () => {
      document.removeEventListener("visibilitychange", tick);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export type Route =
  { name: "home" } | { name: "category"; id: string } | { name: "settings" };

function parseHash(hash: string): Route {
  const m = /^#\/c\/([\w-]+)$/.exec(hash);
  if (m) return { name: "category", id: m[1] };
  if (hash === "#/settings") return { name: "settings" };
  return { name: "home" };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/**
 * Calls `onRemind` with the timers that completed another reminder interval.
 * Intervals already elapsed when a timer is first seen (e.g. after reload) don't fire.
 */
export function useReminder(
  timers: ActiveTimer[],
  settings: Settings,
  now: number,
  onRemind: (due: ActiveTimer[]) => void,
): void {
  // Per category: start of the timer last seen and reminders already counted.
  const fired = useRef(new Map<string, { start: number; count: number }>());
  useEffect(() => {
    const seen = fired.current;
    if (!settings.reminderEnabled) {
      seen.clear();
      return;
    }
    const due: ActiveTimer[] = [];
    for (const t of timers) {
      const count = remindersDue(t, now, settings.reminderMinutes);
      const f = seen.get(t.categoryId);
      if (f?.start !== t.start) {
        seen.set(t.categoryId, { start: t.start, count });
      } else if (count > f.count) {
        f.count = count;
        due.push(t);
      }
    }
    const running = new Set(timers.map((t) => t.categoryId));
    for (const id of [...seen.keys()]) if (!running.has(id)) seen.delete(id);
    if (due.length > 0) onRemind(due);
  }, [
    timers,
    settings.reminderEnabled,
    settings.reminderMinutes,
    now,
    onRemind,
  ]);
}
