import { bookingSeconds } from "./logic";
import {
  type ActiveTimer,
  type Booking,
  type Category,
  type Preset,
  type Settings,
  type State,
  DEFAULT_SETTINGS,
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

function parseCategory(v: unknown, i: number): Category {
  const o = obj(v, `category ${i}`);
  return {
    id: str(o.id, `category ${i} id`, 64),
    name: str(o.name, `category ${i} name`, 100),
    color: color(o.color, `category ${i} color`),
    archivedSeconds: int(o.archivedSeconds, `category ${i} archivedSeconds`),
    presets: arr(o.presets, `category ${i} presets`).map(parsePreset),
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

function parseActive(v: unknown, categoryIds: Set<string>): ActiveTimer | null {
  if (v === null || v === undefined) return null;
  const o = obj(v, "active");
  const categoryId = str(o.categoryId, "active categoryId", 64);
  if (!categoryIds.has(categoryId)) return null;
  return {
    categoryId,
    sign: sign(o.sign, "active sign"),
    start: num(o.start, "active start"),
  };
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
  if (o.version !== 1) throw new ImportError("Unsupported version");
  const categories = arr(o.categories, "categories").map(parseCategory);
  const ids = new Set(categories.map((c) => c.id));
  if (ids.size !== categories.length)
    throw new ImportError("Duplicate category ids");
  return {
    version: 1,
    categories,
    bookings: arr(o.bookings, "bookings").map((b, i) =>
      parseBooking(b, i, ids),
    ),
    active: parseActive(o.active, ids),
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

/** One row per booking plus one "archived" row per category. Times in ISO 8601 UTC. */
export function toCSV(state: State): string {
  const names = new Map(state.categories.map((c) => [c.id, c.name]));
  const rows = [
    ["category", "start", "end", "seconds", "source", "note"].join(","),
  ];
  for (const c of state.categories) {
    rows.push(
      [
        csvField(c.name),
        "",
        "",
        String(c.archivedSeconds),
        "archived",
        '""',
      ].join(","),
    );
  }
  const sorted = [...state.bookings].sort((a, b) => a.start - b.start);
  for (const b of sorted) {
    rows.push(
      [
        csvField(names.get(b.categoryId) ?? ""),
        new Date(b.start).toISOString(),
        new Date(b.end).toISOString(),
        String(bookingSeconds(b)),
        b.source,
        csvField(b.note),
      ].join(","),
    );
  }
  return rows.join("\n") + "\n";
}
