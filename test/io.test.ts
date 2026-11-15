import { describe, expect, it } from "vitest";
import { ImportError, parseState, toCSV, toJSON } from "../src/io";
import {
  addBooking,
  addCategory,
  startTimer,
  updateCategory,
} from "../src/logic";
import { HOUR, T0, withCategory } from "./helpers";

describe("JSON", () => {
  it("round-trips the full state", () => {
    const [s0, id] = withCategory();
    let s = addBooking(s0, {
      categoryId: id,
      start: T0,
      end: T0 + HOUR,
      sign: -1,
      note: "n",
      source: "manual",
    });
    s = startTimer(s, id, 1, T0 + 2 * HOUR);
    s = addCategory(s, "Other", "#000000");
    s = updateCategory(s, { ...s.categories[1], negativeFactor: 1.5 });
    s = startTimer(s, s.categories[1].id, -1, T0 + 3 * HOUR);
    expect(parseState(toJSON(s))).toEqual(s);
  });

  it("migrates version 1 data", () => {
    const v1 = {
      version: 1,
      categories: [
        {
          id: "a",
          name: "A",
          color: "#000000",
          archivedSeconds: -90,
          presets: [],
        },
        {
          id: "b",
          name: "B",
          color: "#000000",
          archivedSeconds: 60,
          presets: [],
        },
      ],
      bookings: [],
      active: { categoryId: "b", sign: 1, start: T0 },
    };
    const s = parseState(JSON.stringify(v1));
    expect(s.version).toBe(2);
    expect(s.categories[0]).toMatchObject({
      archivedPositive: 0,
      archivedNegative: 90,
      negativeFactor: 1,
    });
    expect(s.categories[1]).toMatchObject({
      archivedPositive: 60,
      archivedNegative: 0,
    });
    expect(s.timers).toEqual([{ categoryId: "b", sign: 1, start: T0 }]);
    expect(parseState(JSON.stringify({ ...v1, active: null })).timers).toEqual(
      [],
    );
  });

  it("drops timers of unknown or duplicate categories", () => {
    const [s0, id] = withCategory();
    const t = { categoryId: id, sign: 1, start: T0 };
    const text = JSON.stringify({
      ...s0,
      timers: [t, { ...t, start: T0 + 1 }, { ...t, categoryId: "x" }],
    });
    expect(parseState(text).timers).toEqual([t]);
  });

  it.each([
    ["not json", "{"],
    ["wrong version", '{"version":3,"categories":[],"bookings":[]}'],
    [
      "bad factor",
      JSON.stringify({
        version: 2,
        categories: [
          {
            id: "c",
            name: "c",
            color: "#000000",
            archivedPositive: 0,
            archivedNegative: 0,
            negativeFactor: 0,
            presets: [],
          },
        ],
        bookings: [],
        timers: [],
      }),
    ],
    [
      "negative archived sum",
      JSON.stringify({
        version: 2,
        categories: [
          {
            id: "c",
            name: "c",
            color: "#000000",
            archivedPositive: -1,
            archivedNegative: 0,
            negativeFactor: 1,
            presets: [],
          },
        ],
        bookings: [],
        timers: [],
      }),
    ],
    [
      "unknown category",
      '{"version":1,"categories":[],"bookings":[{"id":"b","categoryId":"x","start":0,"end":1,"sign":1,"note":"","source":"manual"}]}',
    ],
    [
      "bad sign",
      JSON.stringify({
        version: 1,
        categories: [
          {
            id: "c",
            name: "c",
            color: "#000000",
            archivedSeconds: 0,
            presets: [],
          },
        ],
        bookings: [
          {
            id: "b",
            categoryId: "c",
            start: 0,
            end: 1,
            sign: 2,
            note: "",
            source: "manual",
          },
        ],
      }),
    ],
    [
      "bad color",
      JSON.stringify({
        version: 1,
        categories: [
          {
            id: "c",
            name: "c",
            color: "red;x",
            archivedSeconds: 0,
            presets: [],
          },
        ],
        bookings: [],
      }),
    ],
  ])("rejects %s", (_, text) => {
    expect(() => parseState(text)).toThrow(ImportError);
  });
});

describe("CSV", () => {
  it("writes archived and booking rows, escaping formulas and quotes", () => {
    const [s0, id] = withCategory('=cmd"x');
    const s1 = updateCategory(s0, { ...s0.categories[0], negativeFactor: 2 });
    const s = addBooking(s1, {
      categoryId: id,
      start: T0,
      end: T0 + HOUR,
      sign: -1,
      note: "+evil",
      source: "manual",
    });
    const lines = toCSV(s).trim().split("\n");
    expect(lines[0]).toBe("category,start,end,seconds,counted,source,note");
    expect(lines[1]).toBe(`"'=cmd""x",,,0,0,archived,""`);
    expect(lines[2]).toContain(',-3600,-7200,manual,"\'+evil"');
  });
});
