import { describe, expect, it } from "vitest";
import type { Step } from "../../shared/engine";
import { buildShareText, describeRoute, pluralise, shareGrid } from "./share";

const step = (move: 0 | 1 | 2 | 3, bust = false): Step => ({ move, bust });

describe("shareGrid", () => {
  it("draws one coloured square per click and a burst for each bust", () => {
    expect(shareGrid([step(0), step(1), step(2, true), step(3)])).toBe("🟦🟩💥🟧");
  });

  it("wraps long runs every ten clicks", () => {
    const grid = shareGrid(Array.from({ length: 23 }, () => step(0)));
    expect(grid.split("\n").map((row) => Array.from(row).length)).toEqual([10, 10, 3]);
  });
});

describe("buildShareText", () => {
  const base = {
    number: 7,
    clicks: 9,
    minClicks: 5,
    busts: 1,
    rating: "sharp" as const,
    steps: [step(0), step(2, true), step(3)],
    url: "https://example.test/",
  };

  it("summarises the run on four lines", () => {
    expect(buildShareText(base)).toBe(
      [
        "💎 Crystal Collector #7",
        "Sharp · 9 clicks (min 5) · 1 bust",
        "🟦💥🟧",
        "https://example.test/",
      ].join("\n"),
    );
  });

  it("leaves out busts when there were none and singularises one click", () => {
    const text = buildShareText({ ...base, busts: 0, clicks: 1, rating: "crystal-clear" });
    expect(text).toContain("Crystal clear · 1 click (min 5)");
    expect(text).not.toContain("bust");
  });
});

describe("pluralise", () => {
  it("only adds an s when the count is not one", () => {
    expect(pluralise(1, "click")).toBe("1 click");
    expect(pluralise(0, "bust")).toBe("0 busts");
    expect(pluralise(2, "bust")).toBe("2 busts");
  });
});

describe("describeRoute", () => {
  it("lists only the crystals a route uses", () => {
    expect(describeRoute([3, 0, 2, 0])).toBe("3× 🟦 + 2× 🟥");
    expect(describeRoute([0, 1, 0, 1])).toBe("1× 🟩 + 1× 🟧");
  });
});
