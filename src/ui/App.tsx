import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { compact, elapsedSeconds, liveBalance, stopTimer } from "../logic";
import type { State } from "../model";
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
  const now = useNow(state.active ? 1000 : null);

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

  const remind = useCallback(() => {
    const s = stateRef.current;
    const cat = s.categories.find((c) => c.id === s.active?.categoryId);
    notify(`⏱ ${cat?.name ?? "Timer"} is still running`);
    if (s.settings.reminderSound) beep();
    navigator.vibrate?.([200, 100, 200]);
  }, [notify]);
  useReminder(state.active, state.settings, now, remind);

  const active = state.active;
  const activeCat =
    active && state.categories.find((c) => c.id === active.categoryId);
  useEffect(() => {
    document.title = active
      ? `${formatDuration(elapsedSeconds(active, now), { signed: false, showSeconds: true })} · UpDown`
      : "UpDown";
  }, [active, now]);

  return (
    <div class="app">
      <header class="topbar">
        <a href="#/" class="brand">
          UpDown
        </a>
        <a href="#/settings" class="iconlink" aria-label="Settings">
          ⚙︎
        </a>
      </header>

      {active && activeCat && (
        <div class="running" style={{ "--cat": activeCat.color }}>
          <a href={`#/c/${activeCat.id}`} class="running-info">
            <span class="running-name">
              {active.sign > 0 ? "＋" : "－"} {activeCat.name}
            </span>
            <span class="running-time">
              {formatDuration(elapsedSeconds(active, now), {
                signed: false,
                showSeconds: true,
              })}
            </span>
            <span class="running-balance">
              Balance{" "}
              {formatDuration(liveBalance(state, activeCat.id, now), {
                showSeconds: true,
              })}
            </span>
          </a>
          <button
            class="btn stop"
            onClick={() => update((s, t) => stopTimer(s, t))}
          >
            ■ Stop
          </button>
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
