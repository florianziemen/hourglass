import { describe, expect, it } from "vitest";
import {
  ValidationError,
  addBooking,
  addCategory,
  applyPreset,
  balance,
  compact,
  compactionCutoff,
  deleteBooking,
  deleteCategory,
  liveBalance,
  moveCategory,
  remindersDue,
  startTimer,
  stopTimer,
  updateBooking,
  updateCategory,
  updateSettings,
} from "../src/logic";
import { emptyState } from "../src/model";
import { HOUR, MIN, T0, withCategory } from "./helpers";

describe("timer", () => {
  it("books elapsed time with the chosen sign on stop", () => {
    const [s0, id] = withCategory();
    const s = stopTimer(startTimer(s0, id, -1, T0), T0 + 90 * MIN);
    expect(s.active).toBeNull();
    expect(s.bookings).toHaveLength(1);
    expect(s.bookings[0]).toMatchObject({
      start: T0,
      end: T0 + 90 * MIN,
      sign: -1,
      source: "timer",
    });
    expect(balance(s, id)).toBe(-90 * 60);
  });

  it("starting another timer stops and books the running one", () => {
    const [s0, a] = withCategory("A");
    let s = addCategory(s0, "B", "#000000");
    const b = s.categories[1].id;
    s = startTimer(s, a, 1, T0);
    s = startTimer(s, b, 1, T0 + HOUR);
    expect(s.active).toMatchObject({ categoryId: b, start: T0 + HOUR });
    expect(balance(s, a)).toBe(3600);
  });

  it("discards sessions shorter than a second", () => {
    const [s0, id] = withCategory();
    const s = stopTimer(startTimer(s0, id, 1, T0), T0 + 500);
    expect(s.active).toBeNull();
    expect(s.bookings).toHaveLength(0);
  });

  it("liveBalance includes the running timer only for its category", () => {
    const [s0, a] = withCategory("A");
    let s = addCategory(s0, "B", "#000000");
    const b = s.categories[1].id;
    s = startTimer(s, a, -1, T0);
    expect(liveBalance(s, a, T0 + 10 * MIN)).toBe(-600);
    expect(liveBalance(s, b, T0 + 10 * MIN)).toBe(0);
  });

  it("rejects unknown categories", () => {
    expect(() => startTimer(emptyState(), "nope", 1, T0)).toThrow(
      ValidationError,
    );
  });

  it("counts completed reminder intervals", () => {
    const active = { categoryId: "x", sign: 1 as const, start: T0 };
    expect(remindersDue(active, T0 + 29 * MIN, 30)).toBe(0);
    expect(remindersDue(active, T0 + 30 * MIN, 30)).toBe(1);
    expect(remindersDue(active, T0 + 95 * MIN, 30)).toBe(3);
  });
});

describe("bookings", () => {
  it("applies presets as bookings ending now", () => {
    const [s0, id] = withCategory();
    const [plus, minus] = s0.categories[0].presets;
    let s = applyPreset(s0, id, plus, T0);
    s = applyPreset(s, id, minus, T0);
    s = applyPreset(s, id, minus, T0);
    expect(balance(s, id)).toBe(-15 * 60);
    expect(s.bookings[0]).toMatchObject({
      start: T0 - 15 * MIN,
      end: T0,
      sign: 1,
      source: "preset",
    });
  });

  it("edits and deletes bookings", () => {
    const [s0, id] = withCategory();
    let s = addBooking(s0, {
      categoryId: id,
      start: T0,
      end: T0 + HOUR,
      sign: 1,
      note: "",
      source: "manual",
    });
    const b = s.bookings[0];
    s = updateBooking(s, { ...b, sign: -1, end: T0 + 2 * HOUR, note: "fixed" });
    expect(balance(s, id)).toBe(-7200);
    expect(s.bookings[0].note).toBe("fixed");
    s = deleteBooking(s, b.id);
    expect(s.bookings).toHaveLength(0);
  });

  it("rejects end before start and edits of vanished bookings", () => {
    const [s0, id] = withCategory();
    const input = {
      categoryId: id,
      start: T0,
      end: T0 - 1,
      sign: 1 as const,
      note: "",
      source: "manual" as const,
    };
    expect(() => addBooking(s0, input)).toThrow(ValidationError);
    expect(() => updateBooking(s0, { ...input, id: "gone", end: T0 })).toThrow(
      /no longer exists/,
    );
  });
});

describe("compaction", () => {
  it("folds bookings ended over a month ago into archivedSeconds", () => {
    const [s0, id] = withCategory();
    const cutoff = compactionCutoff(T0);
    let s = addBooking(s0, {
      categoryId: id,
      start: cutoff - 2 * HOUR,
      end: cutoff - HOUR,
      sign: 1,
      note: "",
      source: "manual",
    });
    s = addBooking(s, {
      categoryId: id,
      start: cutoff - 3 * HOUR,
      end: cutoff - 2 * HOUR,
      sign: -1,
      note: "",
      source: "manual",
    });
    s = addBooking(s, {
      categoryId: id,
      start: cutoff - 30 * MIN,
      end: cutoff + 1,
      sign: 1,
      note: "",
      source: "manual",
    });
    s = addBooking(s, {
      categoryId: id,
      start: cutoff - 3 * HOUR,
      end: cutoff - 2 * HOUR,
      sign: 1,
      note: "",
      source: "manual",
    });
    const before = balance(s, id);
    const c = compact(s, T0);
    expect(c.bookings).toHaveLength(1); // the one ending after the cutoff
    expect(c.categories[0].archivedSeconds).toBe(3600);
    expect(balance(c, id)).toBe(before);
  });

  it("returns the same object when nothing is old", () => {
    const [s] = withCategory();
    expect(compact(s, T0)).toBe(s);
  });

  it("uses a calendar month", () => {
    expect(new Date(compactionCutoff(T0)).getMonth()).toBe(8);
  });
});

describe("categories and settings", () => {
  it("creates categories with default ±15 min presets", () => {
    const [s] = withCategory();
    expect(s.categories[0].presets.map((p) => p.seconds)).toEqual([900, -900]);
  });

  it("validates names and presets", () => {
    expect(() => addCategory(emptyState(), "  ", "#000000")).toThrow(
      ValidationError,
    );
    const [s] = withCategory();
    const cat = s.categories[0];
    expect(() =>
      updateCategory(s, {
        ...cat,
        presets: [{ id: "p", label: "x", seconds: 0 }],
      }),
    ).toThrow(ValidationError);
  });

  it("deleting a category removes its bookings and running timer", () => {
    const [s0, id] = withCategory();
    let s = applyPreset(s0, id, s0.categories[0].presets[0], T0);
    s = startTimer(s, id, 1, T0);
    s = deleteCategory(s, id);
    expect(s.categories).toHaveLength(0);
    expect(s.bookings).toHaveLength(0);
    expect(s.active).toBeNull();
  });

  it("reorders categories within bounds", () => {
    const s = addCategory(withCategory("A")[0], "B", "#000000");
    const a = s.categories[0].id;
    expect(moveCategory(s, a, -1)).toBe(s);
    expect(moveCategory(s, a, 1).categories.map((c) => c.name)).toEqual([
      "B",
      "A",
    ]);
  });

  it("validates the reminder interval", () => {
    const s = emptyState();
    expect(() =>
      updateSettings(s, { ...s.settings, reminderMinutes: 0 }),
    ).toThrow(ValidationError);
    expect(
      updateSettings(s, { ...s.settings, reminderMinutes: 45 }).settings
        .reminderMinutes,
    ).toBe(45);
  });
});
