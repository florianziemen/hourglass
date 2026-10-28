import { useEffect, useState } from "preact/hooks";
import { updateSettings } from "../logic";
import type { State } from "../model";
import { ImportError, parseState, toCSV, toJSON } from "../io";
import type { Update } from "./App";
import { beep, unlockAudio } from "./audio";

interface Props {
  state: State;
  update: Update;
  notify: (text: string, error?: boolean) => void;
}

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export function SettingsView({ state, update, notify }: Props) {
  const s = state.settings;
  const [minutes, setMinutes] = useState(String(s.reminderMinutes));
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted, () => setPersisted(null));
  }, []);

  const exportFile = async (kind: "json" | "csv") => {
    const stamp = new Date().toISOString().slice(0, 10);
    const file = new File(
      [kind === "json" ? toJSON(state) : toCSV(state)],
      `hourglass-${stamp}.${kind}`,
      { type: kind === "json" ? "application/json" : "text/csv" },
    );
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.warn("Share failed, falling back to download", e);
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      notify("File too large", true);
      return;
    }
    try {
      const next = parseState(await file.text());
      if (!confirm(`Replace all current data with “${file.name}”?`)) return;
      if (update(() => next)) notify("Import complete");
    } catch (err) {
      notify(
        err instanceof ImportError
          ? `Import failed: ${err.message}`
          : String(err),
        true,
      );
    }
  };

  const requestPersist = async () => {
    const ok = (await navigator.storage?.persist?.()) ?? false;
    setPersisted(ok);
    notify(
      ok ? "Storage marked persistent" : "Browser declined persistent storage",
      !ok,
    );
  };

  return (
    <section>
      <h1>Settings</h1>

      <div class="panel">
        <h2>Reminder while a timer runs</h2>
        <label class="check">
          <input
            type="checkbox"
            checked={s.reminderEnabled}
            onChange={(e) =>
              update((st) =>
                updateSettings(st, {
                  ...s,
                  reminderEnabled: e.currentTarget.checked,
                }),
              )
            }
          />
          Remind me
        </label>
        <form
          class="row"
          onSubmit={(e) => {
            e.preventDefault();
            update((st) =>
              updateSettings(st, { ...s, reminderMinutes: Number(minutes) }),
            );
          }}
        >
          <span>Every</span>
          <input
            type="number"
            min="1"
            max="720"
            step="1"
            class="narrow"
            value={minutes}
            onInput={(e) => setMinutes(e.currentTarget.value)}
            aria-label="Reminder interval in minutes"
          />
          <span>min</span>
          <button
            class="btn"
            type="submit"
            disabled={Number(minutes) === s.reminderMinutes}
          >
            Set
          </button>
        </form>
        <label class="check">
          <input
            type="checkbox"
            checked={s.reminderSound}
            onChange={(e) =>
              update((st) =>
                updateSettings(st, {
                  ...s,
                  reminderSound: e.currentTarget.checked,
                }),
              )
            }
          />
          Play sound
        </label>
        <button
          class="btn"
          onClick={() => {
            unlockAudio();
            beep();
          }}
        >
          Test sound
        </button>
        <p class="muted small">
          Web apps on iPhone can only remind you while the app is open on
          screen. Sound follows the ring/silent switch; iOS does not support
          vibration from web apps.
        </p>
      </div>

      <div class="panel">
        <h2>Data</h2>
        <p class="muted small">
          All data stays on this device. Bookings older than a month are folded
          into each category’s archived sum.
        </p>
        <div class="row wrap">
          <button class="btn" onClick={() => exportFile("json")}>
            Export JSON (backup)
          </button>
          <button class="btn" onClick={() => exportFile("csv")}>
            Export CSV
          </button>
          <label class="btn">
            Import JSON…
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={importFile}
            />
          </label>
        </div>
        {persisted !== null && (
          <p class="small">
            Storage:{" "}
            {persisted
              ? "persistent"
              : "may be cleared by the browser under pressure"}{" "}
            {!persisted && (
              <button class="btn small" onClick={requestPersist}>
                Request persistence
              </button>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
