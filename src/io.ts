import { archivedBalance, bookingSeconds, weigh } from "./logic";
import {
  type ActiveTimer,
  type Booking,
  type Category,
  type Preset,
  type Settings,
  type State,
  DEFAULT_SETTINGS,
  MAX_FACTOR,
  MIN_FACTOR,
} from "./model";

export class ImportError extends Error {}

type Json = Record<string, unknown>;

function obj(v: unknown, what: string): Json {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new ImportError(`${what}: expected object`);
  }
  return v as Json;
}

function arr(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) throw new ImportError(`${what}: expected array`);
  return v;
}

function str(v: unknown, what: string, maxLen = 1000): string {
  if (typeof v !== "string" || v.length > maxLen)
    throw new ImportError(`${what}: invalid string`);
  return v;
}

function num(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new ImportError(`${what}: invalid number`);
  return v;
}

function int(v: unknown, what: string): number {
  const n = num(v, what);
  if (!Number.isInteger(n)) throw new ImportError(`${what}: expected integer`);
  return n;
}

function sign(v: unknown, what: string): 1 | -1 {
  if (v !== 1 && v !== -1) throw new ImportError(`${what}: invalid sign`);
  return v;
}

function color(v: unknown, what: string): string {
  const s = str(v, what, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(s))
    throw new ImportError(`${what}: invalid color`);
  return s;
}

function parsePreset(v: unknown, i: number): Preset {
  const o = obj(v, `preset ${i}`);
  const seconds = int(o.seconds, `preset ${i} seconds`);
  if (seconds === 0) throw new ImportError(`preset ${i}: zero duration`);
  return {
    id: str(o.id, `preset ${i} id`, 64),
    label: str(o.label, `preset ${i} label`, 100),
    seconds,
  };
}

function nonNegInt(v: unknown, what: string): number {
  const n = int(v, what);
  if (n < 0) throw new ImportError(`${what}: must not be negative`);
  return n;
}

function factor(v: unknown, what: string): number {
  const n = num(v, what);
  if (n < MIN_FACTOR || n > MAX_FACTOR)
    throw new ImportError(`${what}: out of range`);
  return n;
}

function parseCategory(v: unknown, i: number, version: 1 | 2): Category {
  const o = obj(v, `category ${i}`);
  const what = `category ${i}`;
  let archived: Pick<
    Category,
    "archivedPositive" | "archivedNegative" | "negativeFactor"
  >;
  if (version === 1) {
    // v1 kept only the net archived sum and had no factor.
    const net = int(o.archivedSeconds, `${what} archivedSeconds`);
    archived = {
      archivedPositive: Math.max(net, 0),
      archivedNegative: Math.max(-net, 0),
      negativeFactor: 1,
    };
  } else {
    archived = {
      archivedPositive: nonNegInt(
        o.archivedPositive,
        `${what} archivedPositive`,
      ),
      archivedNegative: nonNegInt(
        o.archivedNegative,
        `${what} archivedNegative`,
      ),
      negativeFactor: factor(o.negativeFactor, `${what} negativeFactor`),
    };
  }
  return {
    id: str(o.id, `${what} id`, 64),
    name: str(o.name, `${what} name`, 100),
    color: color(o.color, `${what} color`),
    ...archived,
    presets: arr(o.presets, `${what} presets`).map(parsePreset),
  };
}

function parseBooking(
  v: unknown,
  i: number,
  categoryIds: Set<string>,
): Booking {
  const o = obj(v, `booking ${i}`);
  const categoryId = str(o.categoryId, `booking ${i} categoryId`, 64);
  if (!categoryIds.has(categoryId))
    throw new ImportError(`booking ${i}: unknown category`);
  const start = num(o.start, `booking ${i} start`);
  const end = num(o.end, `booking ${i} end`);
  if (end < start) throw new ImportError(`booking ${i}: end before start`);
  const source = o.source;
  if (source !== "timer" && source !== "manual" && source !== "preset") {
    throw new ImportError(`booking ${i}: invalid source`);
  }
  return {
    id: str(o.id, `booking ${i} id`, 64),
    categoryId,
    start,
    end,
    sign: sign(o.sign, `booking ${i} sign`),
    note: str(o.note, `booking ${i} note`),
    source,
  };
}

function parseTimer(v: unknown, what: string): ActiveTimer {
  const o = obj(v, what);
  return {
    categoryId: str(o.categoryId, `${what} categoryId`, 64),
    sign: sign(o.sign, `${what} sign`),
    start: num(o.start, `${what} start`),
  };
}

/** v1 had a single `active` timer, v2 a `timers` array. Keeps one timer per known category. */
function parseTimers(
  o: Json,
  version: 1 | 2,
  categoryIds: Set<string>,
): ActiveTimer[] {
  const raw =
    version === 1
      ? o.active === null || o.active === undefined
        ? []
        : [parseTimer(o.active, "active")]
      : arr(o.timers, "timers").map((t, i) => parseTimer(t, `timer ${i}`));
  const seen = new Set<string>();
  return raw.filter((t) => {
    if (!categoryIds.has(t.categoryId) || seen.has(t.categoryId)) return false;
    seen.add(t.categoryId);
    return true;
  });
}

function parseSettings(v: unknown): Settings {
  if (v === undefined) return { ...DEFAULT_SETTINGS };
  const o = obj(v, "settings");
  const minutes = int(o.reminderMinutes, "settings reminderMinutes");
  if (minutes < 1 || minutes > 720)
    throw new ImportError("settings: reminderMinutes out of range");
  return {
    reminderEnabled: o.reminderEnabled === true,
    reminderMinutes: minutes,
    reminderSound: o.reminderSound === true,
  };
}

/** Parse and validate a JSON state dump. Throws ImportError on any malformed content. */
export function parseState(text: string): State {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("Not valid JSON");
  }
  const o = obj(raw, "root");
  const version = o.version;
  if (version !== 1 && version !== 2)
    throw new ImportError("Unsupported version");
  const categories = arr(o.categories, "categories").map((c, i) =>
    parseCategory(c, i, version),
  );
  const ids = new Set(categories.map((c) => c.id));
  if (ids.size !== categories.length)
    throw new ImportError("Duplicate category ids");
  return {
    version: 2,
    categories,
    bookings: arr(o.bookings, "bookings").map((b, i) =>
      parseBooking(b, i, ids),
    ),
    timers: parseTimers(o, version, ids),
    settings: parseSettings(o.settings),
  };
}

export function toJSON(state: State): string {
  return JSON.stringify(state, null, 2);
}

function csvField(value: string): string {
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * One row per booking plus one "archived" row per category. Times in ISO 8601 UTC.
 * `seconds` is the signed raw duration, `counted` includes the category's negative factor.
 */
export function toCSV(state: State): string {
  const cats = new Map(state.categories.map((c) => [c.id, c]));
  const rows = [
    ["category", "start", "end", "seconds", "counted", "source", "note"].join(
      ",",
    ),
  ];
  for (const c of state.categories) {
    rows.push(
      [
        csvField(c.name),
        "",
        "",
        String(c.archivedPositive - c.archivedNegative),
        String(archivedBalance(c)),
        "archived",
        '""',
      ].join(","),
    );
  }
  const sorted = [...state.bookings].sort((a, b) => a.start - b.start);
  for (const b of sorted) {
    const cat = cats.get(b.categoryId);
    const secs = bookingSeconds(b);
    rows.push(
      [
        csvField(cat?.name ?? ""),
        new Date(b.start).toISOString(),
        new Date(b.end).toISOString(),
        String(secs),
        String(cat ? weigh(cat, secs) : secs),
        b.source,
        csvField(b.note),
      ].join(","),
    );
  }
  return rows.join("\n") + "\n";
}
