import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { compact, elapsedSeconds, liveBalance, stopTimer } from "../logic";
import type { ActiveTimer, State } from "../model";
import type { Store } from "../storage";
import { formatDuration } from "../format";
import { beep, unlockAudio } from "./audio";
import { CategoryView } from "./CategoryView";
import { Home } from "./Home";
import { SettingsView } from "./SettingsView";
import { useHashRoute, useNow, useReminder } from "./hooks";

export type Update = (fn: (s: State, now: number) => State) => boolean;

export function App({ store }: { store: Store }) {
  const [state, setState] = useState(() => compact(store.load(), Date.now()));
  const stateRef = useRef(state);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const route = useHashRoute();
  const now = useNow(state.timers.length > 0 ? 1000 : null);

  const notify = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );

  /** Apply a state transition; returns false and shows the error if it throws. */
  const update: Update = useCallback(
    (fn) => {
      const t = Date.now();
      try {
        const next = compact(fn(stateRef.current, t), t);
        stateRef.current = next;
        setState(next);
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : String(e), true);
        return false;
      }
    },
    [notify],
  );

  useEffect(() => {
    try {
      store.save(state);
    } catch (e) {
      notify(
        `Saving failed: ${e instanceof Error ? e.message : String(e)}`,
        true,
      );
    }
  }, [store, state, notify]);

  // Compact again whenever the app comes back to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") update((s) => s); // update() compacts
    };
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("pointerdown", unlockAudio);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerdown", unlockAudio);
    };
  }, [update]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.error ? 6000 : 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const remind = useCallback(
    (due: ActiveTimer[]) => {
      const s = stateRef.current;
      const names = due.map(
        (t) => s.categories.find((c) => c.id === t.categoryId)?.name ?? "Timer",
      );
      notify(
        `⏱ ${names.join(", ")} ${names.length > 1 ? "are" : "is"} still running`,
      );
      if (s.settings.reminderSound) beep();
      navigator.vibrate?.([200, 100, 200]);
    },
    [notify],
  );
  useReminder(state.timers, state.settings, now, remind);

  const running = state.timers.flatMap((t) => {
    const cat = state.categories.find((c) => c.id === t.categoryId);
    return cat ? [{ timer: t, cat }] : [];
  });
  useEffect(() => {
    const t = state.timers;
    document.title =
      t.length === 1
        ? `${formatDuration(elapsedSeconds(t[0], now), { signed: false, showSeconds: true })} · Hourglass`
        : t.length > 1
          ? `${t.length} timers · Hourglass`
          : "Hourglass";
  }, [state.timers, now]);

  return (
    <div class="app">
      <header class="topbar">
        <a href="#/" class="brand">
          Hourglass
        </a>
        <a href="#/settings" class="iconlink" aria-label="Settings">
          ⚙︎
        </a>
      </header>

      {running.length > 0 && (
        <div class="running-list">
          {running.map(({ timer, cat }) => (
            <div key={cat.id} class="running" style={{ "--cat": cat.color }}>
              <a href={`#/c/${cat.id}`} class="running-info">
                <span class="running-name">
                  {timer.sign > 0 ? "＋" : "－"} {cat.name}
                </span>
                <span class="running-time">
                  {formatDuration(elapsedSeconds(timer, now), {
                    signed: false,
                    showSeconds: true,
                  })}
                </span>
                <span class="running-balance">
                  Balance{" "}
                  {formatDuration(liveBalance(state, cat.id, now), {
                    showSeconds: true,
                  })}
                </span>
              </a>
              <button
                class="btn stop"
                onClick={() => update((s, t) => stopTimer(s, cat.id, t))}
              >
                ■ Stop
              </button>
            </div>
          ))}
        </div>
      )}

      <main>
        {route.name === "home" && (
          <Home state={state} now={now} update={update} />
        )}
        {route.name === "category" && (
          <CategoryView
            key={route.id}
            state={state}
            id={route.id}
            now={now}
            update={update}
          />
        )}
        {route.name === "settings" && (
          <SettingsView state={state} update={update} notify={notify} />
        )}
      </main>

      {toast && (
        <div
          class={`toast ${toast.error ? "error" : ""}`}
          role="status"
          onClick={() => setToast(null)}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
