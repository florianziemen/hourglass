import { useState } from "preact/hooks";
import {
  addCategory,
  applyPreset,
  liveBalance,
  startTimer,
  stopTimer,
} from "../logic";
import type { Category, State } from "../model";
import { formatDuration } from "../format";
import type { Update } from "./App";

const PALETTE = [
  "#2f81f7",
  "#3fb950",
  "#d29922",
  "#f85149",
  "#a371f7",
  "#db61a2",
  "#39c5cf",
];

interface Props {
  state: State;
  now: number;
  update: Update;
}

export function Home({ state, now, update }: Props) {
  const [name, setName] = useState("");

  const add = (e: Event) => {
    e.preventDefault();
    const color = PALETTE[state.categories.length % PALETTE.length];
    if (update((s) => addCategory(s, name, color))) setName("");
  };

  return (
    <section>
      {state.categories.length === 0 && (
        <p class="muted">No categories yet. Add one below.</p>
      )}
      <ul class="cards">
        {state.categories.map((c) => (
          <CategoryCard
            key={c.id}
            cat={c}
            state={state}
            now={now}
            update={update}
          />
        ))}
      </ul>
      <form class="row add" onSubmit={add}>
        <input
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="New category"
          maxLength={100}
          aria-label="New category name"
        />
        <button class="btn" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}

function CategoryCard({ cat, state, now, update }: { cat: Category } & Props) {
  const running = state.active?.categoryId === cat.id ? state.active : null;
  const bal = liveBalance(state, cat.id, now);
  return (
    <li
      class={`card ${running ? "is-running" : ""}`}
      style={{ "--cat": cat.color }}
    >
      <a href={`#/c/${cat.id}`} class="card-head">
        <span class="dot" />
        <span class="card-name">{cat.name}</span>
        <span class={`balance ${bal < 0 ? "neg" : "pos"}`}>
          {formatDuration(bal, { showSeconds: !!running })}
        </span>
      </a>
      <div class="row">
        {running ? (
          <button
            class="btn stop grow"
            onClick={() => update((s, t) => stopTimer(s, t))}
          >
            ■ Stop
          </button>
        ) : (
          <>
            <button
              class="btn plus grow"
              onClick={() => update((s, t) => startTimer(s, cat.id, 1, t))}
            >
              ▶ ＋
            </button>
            <button
              class="btn minus grow"
              onClick={() => update((s, t) => startTimer(s, cat.id, -1, t))}
            >
              ▶ －
            </button>
          </>
        )}
      </div>
      {cat.presets.length > 0 && (
        <div class="chips">
          {cat.presets.map((p) => (
            <button
              key={p.id}
              class={`chip ${p.seconds < 0 ? "minus" : "plus"}`}
              onClick={() => update((s, t) => applyPreset(s, cat.id, p, t))}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
