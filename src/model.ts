export type Sign = 1 | -1;
export type Source = "timer" | "manual" | "preset";

export interface Preset {
  id: string;
  label: string;
  /** Signed duration in seconds (positive adds, negative subtracts). */
  seconds: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Seconds of positive bookings that were compacted away (>= 0). */
  archivedPositive: number;
  /** Seconds of negative bookings that were compacted away, as magnitude (>= 0). */
  archivedNegative: number;
  /** Weight of negative time: balance = positive − negativeFactor × negative. */
  negativeFactor: number;
  presets: Preset[];
}

export interface Booking {
  id: string;
  categoryId: string;
  /** Epoch milliseconds. */
  start: number;
  /** Epoch milliseconds, >= start. */
  end: number;
  sign: Sign;
  note: string;
  source: Source;
}

export interface ActiveTimer {
  categoryId: string;
  sign: Sign;
  start: number;
}

export interface Settings {
  reminderEnabled: boolean;
  reminderMinutes: number;
  reminderSound: boolean;
}

export const MIN_FACTOR = 0.01;
export const MAX_FACTOR = 100;

export interface State {
  version: 2;
  categories: Category[];
  bookings: Booking[];
  /** Running timers, at most one per category. */
  timers: ActiveTimer[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  reminderEnabled: true,
  reminderMinutes: 30,
  reminderSound: true,
};

export function emptyState(): State {
  return {
    version: 2,
    categories: [],
    bookings: [],
    timers: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function newId(): string {
  // randomUUID is missing in insecure contexts (e.g. dev server over LAN http).
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
