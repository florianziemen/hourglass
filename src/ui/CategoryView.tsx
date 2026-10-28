import { Fragment } from "preact";
import { useState } from "preact/hooks";
import {
  bookingSeconds,
  compactionCutoff,
  deleteCategory,
  liveBalance,
  moveCategory,
  updateCategory,
} from "../logic";
import { type Booking, type Category, type State, newId } from "../model";
import { formatDay, formatDuration, formatTime, presetLabel } from "../format";
import type { Update } from "./App";
import { BookingEditor } from "./BookingEditor";

interface Props {
  state: State;
  id: string;
  now: number;
  update: Update;
}

export function CategoryView({ state, id, now, update }: Props) {
  const cat = state.categories.find((c) => c.id === id);
  const [editing, setEditing] = useState<Booking | "new" | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  if (!cat) {
    return (
      <p class="muted">
        Category not found. <a href="#/">Back</a>
      </p>
    );
  }

  const bookings = state.bookings
    .filter((b) => b.categoryId === id)
    .sort((a, b) => b.start - a.start);
  const bal = liveBalance(state, id, now);

  return (
    <section style={{ "--cat": cat.color }}>
      <div class="cat-head">
        <a href="#/" class="back" aria-label="Back">
          ‹
        </a>
        <span class="dot" />
        <h1>{cat.name}</h1>
        <span class={`balance big ${bal < 0 ? "neg" : "pos"}`}>
          {formatDuration(bal, {
            showSeconds: state.active?.categoryId === id,
          })}
        </span>
      </div>

      <div class="row">
        <button class="btn grow" onClick={() => setEditing("new")}>
          + Add booking
        </button>
        <button class="btn" onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? "Done" : "Edit category"}
        </button>
      </div>

      {showSettings && (
        <CategorySettings key={cat.id} cat={cat} update={update} />
      )}

      <ul class="bookings">
        {bookings.map((b, i) => {
          const newDay =
            i === 0 || formatDay(bookings[i - 1].start) !== formatDay(b.start);
          const secs = bookingSeconds(b);
          return (
            <Fragment key={b.id}>
              {newDay && <li class="day">{formatDay(b.start)}</li>}
              <li>
                <button class="booking" onClick={() => setEditing(b)}>
                  <span class="when">
                    {formatTime(b.start)}–{formatTime(b.end)}
                  </span>
                  <span class="note">{b.note || sourceLabel(b)}</span>
                  <span class={`amount ${secs < 0 ? "neg" : "pos"}`}>
                    {formatDuration(secs)}
                  </span>
                </button>
              </li>
            </Fragment>
          );
        })}
        <li class="archived">
          <span>Before {formatDay(compactionCutoff(now))} (archived)</span>
          <span class={`amount ${cat.archivedSeconds < 0 ? "neg" : "pos"}`}>
            {formatDuration(cat.archivedSeconds)}
          </span>
        </li>
      </ul>

      {editing && (
        <BookingEditor
          state={state}
          categoryId={id}
          booking={editing === "new" ? null : editing}
          now={now}
          update={update}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function sourceLabel(b: Booking): string {
  return { timer: "Timer", manual: "Manual", preset: "Preset" }[b.source];
}

function CategorySettings({ cat, update }: { cat: Category; update: Update }) {
  const [name, setName] = useState(cat.name);
  const [minutes, setMinutes] = useState("15");
  const [label, setLabel] = useState("");

  const save = (next: Category) => update((s) => updateCategory(s, next));

  const addPreset = (e: Event) => {
    e.preventDefault();
    const m = Number(minutes);
    if (!Number.isFinite(m) || m === 0) return;
    const seconds = Math.round(m * 60);
    const preset = {
      id: newId(),
      label: label.trim() || presetLabel(seconds),
      seconds,
    };
    if (save({ ...cat, presets: [...cat.presets, preset] })) setLabel("");
  };

  const remove = () => {
    if (
      confirm(
        `Delete “${cat.name}” and all its bookings? This cannot be undone.`,
      )
    ) {
      if (update((s) => deleteCategory(s, cat.id))) location.hash = "#/";
    }
  };

  return (
    <div class="panel">
      <form
        class="row"
        onSubmit={(e) => {
          e.preventDefault();
          save({ ...cat, name });
        }}
      >
        <input
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
          maxLength={100}
          aria-label="Name"
        />
        <input
          type="color"
          value={cat.color}
          onChange={(e) => save({ ...cat, color: e.currentTarget.value })}
          aria-label="Color"
        />
        <button
          class="btn"
          type="submit"
          disabled={!name.trim() || name === cat.name}
        >
          Rename
        </button>
      </form>

      <h2>Quick bookings</h2>
      <ul class="presets">
        {cat.presets.map((p) => (
          <li key={p.id} class="row">
            <span class="grow">{p.label}</span>
            <span class={p.seconds < 0 ? "neg" : "pos"}>
              {presetLabel(p.seconds)}
            </span>
            <button
              class="btn small"
              aria-label={`Remove ${p.label}`}
              onClick={() =>
                save({
                  ...cat,
                  presets: cat.presets.filter((x) => x.id !== p.id),
                })
              }
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form class="row" onSubmit={addPreset}>
        <input
          type="number"
          step="1"
          value={minutes}
          onInput={(e) => setMinutes(e.currentTarget.value)}
          aria-label="Minutes (negative subtracts)"
          class="narrow"
        />
        <span class="muted">min</span>
        <input
          value={label}
          onInput={(e) => setLabel(e.currentTarget.value)}
          placeholder="Label (optional)"
          maxLength={100}
          class="grow"
        />
        <button class="btn" type="submit">
          Add
        </button>
      </form>
      <p class="muted small">Negative minutes subtract, e.g. −30.</p>

      <div class="row">
        <button
          class="btn"
          onClick={() => update((s) => moveCategory(s, cat.id, -1))}
        >
          ↑ Up
        </button>
        <button
          class="btn"
          onClick={() => update((s) => moveCategory(s, cat.id, 1))}
        >
          ↓ Down
        </button>
        <span class="grow" />
        <button class="btn danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}
