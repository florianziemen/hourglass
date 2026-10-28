import { describe, expect, it } from "vitest";
import { ImportError, parseState, toCSV, toJSON } from "../src/io";
import { addBooking, startTimer } from "../src/logic";
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
    expect(parseState(toJSON(s))).toEqual(s);
  });

  it.each([
    ["not json", "{"],
    ["wrong version", '{"version":2,"categories":[],"bookings":[]}'],
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
    const s = addBooking(s0, {
      categoryId: id,
      start: T0,
      end: T0 + HOUR,
      sign: -1,
      note: "+evil",
      source: "manual",
    });
    const lines = toCSV(s).trim().split("\n");
    expect(lines[0]).toBe("category,start,end,seconds,source,note");
    expect(lines[1]).toBe(`"'=cmd""x",,,0,archived,""`);
    expect(lines[2]).toContain(',-3600,manual,"\'+evil"');
  });
});
