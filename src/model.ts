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
  /** Net seconds of bookings that were compacted away. */
  archivedSeconds: number;
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

export interface State {
  version: 1;
  categories: Category[];
  bookings: Booking[];
  active: ActiveTimer | null;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  reminderEnabled: true,
  reminderMinutes: 30,
  reminderSound: true,
};

export function emptyState(): State {
  return {
    version: 1,
    categories: [],
    bookings: [],
    active: null,
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
