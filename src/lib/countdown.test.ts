import { describe, expect, it } from "vitest";
import { formatCountdown, msUntilNextPuzzle } from "./countdown";

describe("msUntilNextPuzzle", () => {
  it("counts down to the next 00:00 UTC", () => {
    expect(msUntilNextPuzzle(new Date("2026-10-25T23:59:59.000Z"))).toBe(1000);
    expect(msUntilNextPuzzle(new Date("2026-10-25T12:00:00.000Z"))).toBe(12 * 3_600_000);
  });

  it("restarts a full day at midnight", () => {
    expect(msUntilNextPuzzle(new Date("2026-10-26T00:00:00.000Z"))).toBe(86_400_000);
  });
});

describe("formatCountdown", () => {
  it("formats hours, minutes and seconds", () => {
    expect(formatCountdown(3_661_000)).toBe("01:01:01");
    expect(formatCountdown(59_000)).toBe("00:00:59");
  });

  it("rounds partial seconds up and never goes negative", () => {
    expect(formatCountdown(1)).toBe("00:00:01");
    expect(formatCountdown(-500)).toBe("00:00:00");
  });
});
