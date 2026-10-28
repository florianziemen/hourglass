import { useState } from "preact/hooks";
import {
  addBooking,
  compactionCutoff,
  deleteBooking,
  updateBooking,
} from "../logic";
import type { Booking, Sign, State } from "../model";
import { formatDuration, fromLocalInput, toLocalInput } from "../format";
import type { Update } from "./App";

interface Props {
  state: State;
  categoryId: string;
  booking: Booking | null;
  now: number;
  update: Update;
  onClose: () => void;
}

export function BookingEditor({
  state,
  categoryId,
  booking,
  now,
  update,
  onClose,
}: Props) {
  const [catId, setCatId] = useState(booking?.categoryId ?? categoryId);
  const [start, setStart] = useState(
    toLocalInput(booking?.start ?? now - 3600_000),
  );
  const [end, setEnd] = useState(toLocalInput(booking?.end ?? now));
  const [sign, setSign] = useState<Sign>(booking?.sign ?? 1);
  const [note, setNote] = useState(booking?.note ?? "");

  const startMs = fromLocalInput(start);
  const endMs = fromLocalInput(end);
  const valid =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs;

  const save = (e: Event) => {
    e.preventDefault();
    const fields = {
      categoryId: catId,
      start: startMs,
      end: endMs,
      sign,
      note: note.trim(),
    };
    const ok = booking
      ? update((s) => updateBooking(s, { ...booking, ...fields }))
      : update((s) => addBooking(s, { ...fields, source: "manual" }));
    if (ok) onClose();
  };

  const remove = () => {
    if (
      booking &&
      confirm("Delete this booking?") &&
      update((s) => deleteBooking(s, booking.id))
    ) {
      onClose();
    }
  };

  return (
    <div
      class="modal"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form class="panel dialog" onSubmit={save}>
        <h2>{booking ? "Edit booking" : "New booking"}</h2>
        <label>
          Category
          <select
            value={catId}
            onChange={(e) => setCatId(e.currentTarget.value)}
          >
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div class="seg" role="radiogroup" aria-label="Direction">
          <button
            type="button"
            class={sign > 0 ? "on plus" : ""}
            aria-pressed={sign > 0}
            onClick={() => setSign(1)}
          >
            ＋ Add
          </button>
          <button
            type="button"
            class={sign < 0 ? "on minus" : ""}
            aria-pressed={sign < 0}
            onClick={() => setSign(-1)}
          >
            － Subtract
          </button>
        </div>
        <label>
          Start
          <input
            type="datetime-local"
            step="1"
            value={start}
            onInput={(e) => setStart(e.currentTarget.value)}
            required
          />
        </label>
        <label>
          End
          <input
            type="datetime-local"
            step="1"
            value={end}
            onInput={(e) => setEnd(e.currentTarget.value)}
            required
          />
        </label>
        <label>
          Note
          <input
            value={note}
            onInput={(e) => setNote(e.currentTarget.value)}
            maxLength={1000}
          />
        </label>
        <p class={valid ? "muted" : "neg"}>
          {valid
            ? `Effect: ${formatDuration((sign * Math.round(endMs - startMs)) / 1000, { showSeconds: true })}`
            : "End must be after start"}
        </p>
        {valid && endMs < compactionCutoff(now) && (
          <p class="warn">
            Ends more than a month ago: it will be folded into the archived sum
            and can no longer be edited.
          </p>
        )}
        <div class="row">
          {booking && (
            <button type="button" class="btn danger" onClick={remove}>
              Delete
            </button>
          )}
          <span class="grow" />
          <button type="button" class="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" class="btn primary" disabled={!valid}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
