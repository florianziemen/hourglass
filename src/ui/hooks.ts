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
 * Calls `onRemind` whenever the running timer completes another reminder interval.
 * Intervals already elapsed when a timer is first seen (e.g. after reload) don't fire.
 */
export function useReminder(
  active: ActiveTimer | null,
  settings: Settings,
  now: number,
  onRemind: () => void,
): void {
  const fired = useRef<{ start: number; count: number } | null>(null);
  useEffect(() => {
    if (!active || !settings.reminderEnabled) {
      fired.current = null;
      return;
    }
    const due = remindersDue(active, now, settings.reminderMinutes);
    if (fired.current?.start !== active.start) {
      fired.current = { start: active.start, count: due };
      return;
    }
    if (due > fired.current.count) {
      fired.current.count = due;
      onRemind();
    }
  }, [
    active,
    settings.reminderEnabled,
    settings.reminderMinutes,
    now,
    onRemind,
  ]);
}
