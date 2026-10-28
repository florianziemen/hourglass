import { describe, expect, it } from "vitest";
import {
  formatDuration,
  fromLocalInput,
  presetLabel,
  toLocalInput,
} from "../src/format";
import { T0 } from "./helpers";

describe("format", () => {
  it("formats signed durations", () => {
    expect(formatDuration(3723)).toBe("+1:02");
    expect(formatDuration(-3723, { showSeconds: true })).toBe("−1:02:03");
    expect(formatDuration(-59, { signed: false })).toBe("0:00");
  });

  it("labels presets", () => {
    expect(presetLabel(900)).toBe("+15 min");
    expect(presetLabel(-5400)).toBe("−1 h 30 min");
    expect(presetLabel(3600)).toBe("+1 h");
  });

  it("round-trips datetime-local values", () => {
    expect(fromLocalInput(toLocalInput(T0))).toBe(T0);
    expect(fromLocalInput("")).toBeNaN();
  });
});
