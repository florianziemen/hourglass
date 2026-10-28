import {
  type ActiveTimer,
  type Booking,
  type Category,
  type Preset,
  type Settings,
  type Sign,
  type State,
  newId,
} from "./model";

/** Timer sessions shorter than this are discarded instead of booked. */
const MIN_TIMER_MS = 1000;

export class ValidationError extends Error {}

function check(cond: boolean, message: string): asserts cond {
  if (!cond) throw new ValidationError(message);
}

export function bookingSeconds(b: Booking): number {
  return b.sign * Math.round((b.end - b.start) / 1000);
}

export function elapsedSeconds(active: ActiveTimer, now: number): number {
  return Math.max(0, Math.floor((now - active.start) / 1000));
}

export function balance(state: State, categoryId: string): number {
  const cat = state.categories.find((c) => c.id === categoryId);
  if (!cat) return 0;
  return state.bookings
    .filter((b) => b.categoryId === categoryId)
    .reduce((sum, b) => sum + bookingSeconds(b), cat.archivedSeconds);
}

/** Balance including the running timer, if it belongs to this category. */
export function liveBalance(
  state: State,
  categoryId: string,
  now: number,
): number {
  const base = balance(state, categoryId);
  const a = state.active;
  return a && a.categoryId === categoryId
    ? base + a.sign * elapsedSeconds(a, now)
    : base;
}

/** Number of reminder intervals completed by the running timer. */
export function remindersDue(
  active: ActiveTimer,
  now: number,
  minutes: number,
): number {
  return Math.floor(elapsedSeconds(active, now) / (minutes * 60));
}

export function compactionCutoff(now: number): number {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  return d.getTime();
}

/** Fold bookings that ended more than a month ago into their category's archived sum. */
export function compact(state: State, now: number): State {
  const cutoff = compactionCutoff(now);
  const old = state.bookings.filter((b) => b.end < cutoff);
  if (old.length === 0) return state;
  const delta = new Map<string, number>();
  for (const b of old)
    delta.set(b.categoryId, (delta.get(b.categoryId) ?? 0) + bookingSeconds(b));
  return {
    ...state,
    categories: state.categories.map((c) =>
      delta.has(c.id)
        ? { ...c, archivedSeconds: c.archivedSeconds + delta.get(c.id)! }
        : c,
    ),
    bookings: state.bookings.filter((b) => b.end >= cutoff),
  };
}

function requireCategory(state: State, categoryId: string): Category {
  const cat = state.categories.find((c) => c.id === categoryId);
  check(cat !== undefined, "Unknown category");
  return cat;
}

// --- timer ---

export function startTimer(
  state: State,
  categoryId: string,
  sign: Sign,
  now: number,
): State {
  requireCategory(state, categoryId);
  return { ...stopTimer(state, now), active: { categoryId, sign, start: now } };
}

export function stopTimer(state: State, now: number): State {
  const a = state.active;
  if (!a) return state;
  if (
    now - a.start < MIN_TIMER_MS ||
    !state.categories.some((c) => c.id === a.categoryId)
  ) {
    return { ...state, active: null };
  }
  const booking: Booking = {
    id: newId(),
    categoryId: a.categoryId,
    start: a.start,
    end: now,
    sign: a.sign,
    note: "",
    source: "timer",
  };
  return { ...state, active: null, bookings: [...state.bookings, booking] };
}

// --- bookings ---

function validateBooking(state: State, b: Omit<Booking, "id">): void {
  requireCategory(state, b.categoryId);
  check(
    Number.isFinite(b.start) && Number.isFinite(b.end),
    "Invalid start or end",
  );
  check(b.end >= b.start, "End must not be before start");
  check(b.sign === 1 || b.sign === -1, "Invalid sign");
}

export function addBooking(state: State, input: Omit<Booking, "id">): State {
  validateBooking(state, input);
  return { ...state, bookings: [...state.bookings, { ...input, id: newId() }] };
}

export function updateBooking(state: State, booking: Booking): State {
  check(
    state.bookings.some((b) => b.id === booking.id),
    "Booking no longer exists (it may have been archived)",
  );
  validateBooking(state, booking);
  return {
    ...state,
    bookings: state.bookings.map((b) => (b.id === booking.id ? booking : b)),
  };
}

export function deleteBooking(state: State, id: string): State {
  return { ...state, bookings: state.bookings.filter((b) => b.id !== id) };
}

export function applyPreset(
  state: State,
  categoryId: string,
  preset: Preset,
  now: number,
): State {
  return addBooking(state, {
    categoryId,
    start: now - Math.abs(preset.seconds) * 1000,
    end: now,
    sign: preset.seconds < 0 ? -1 : 1,
    note: preset.label,
    source: "preset",
  });
}

// --- categories ---

export function defaultPresets(): Preset[] {
  return [
    { id: newId(), label: "+15 min", seconds: 15 * 60 },
    { id: newId(), label: "−15 min", seconds: -15 * 60 },
  ];
}

function validateCategory(c: Category): void {
  check(c.name.trim().length > 0, "Name must not be empty");
  check(Number.isInteger(c.archivedSeconds), "Invalid archived sum");
  for (const p of c.presets) {
    check(
      Number.isInteger(p.seconds) && p.seconds !== 0,
      "Preset duration must be non-zero",
    );
  }
}

export function addCategory(state: State, name: string, color: string): State {
  const cat: Category = {
    id: newId(),
    name: name.trim(),
    color,
    archivedSeconds: 0,
    presets: defaultPresets(),
  };
  validateCategory(cat);
  return { ...state, categories: [...state.categories, cat] };
}

export function updateCategory(state: State, cat: Category): State {
  requireCategory(state, cat.id);
  const clean = { ...cat, name: cat.name.trim() };
  validateCategory(clean);
  return {
    ...state,
    categories: state.categories.map((c) => (c.id === cat.id ? clean : c)),
  };
}

export function deleteCategory(state: State, id: string): State {
  return {
    ...state,
    categories: state.categories.filter((c) => c.id !== id),
    bookings: state.bookings.filter((b) => b.categoryId !== id),
    active: state.active?.categoryId === id ? null : state.active,
  };
}

export function moveCategory(state: State, id: string, delta: -1 | 1): State {
  const i = state.categories.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.categories.length) return state;
  const categories = [...state.categories];
  [categories[i], categories[j]] = [categories[j], categories[i]];
  return { ...state, categories };
}

// --- settings ---

export function updateSettings(state: State, settings: Settings): State {
  check(
    Number.isInteger(settings.reminderMinutes) &&
      settings.reminderMinutes >= 1 &&
      settings.reminderMinutes <= 720,
    "Reminder interval must be 1–720 minutes",
  );
  return { ...state, settings };
}
