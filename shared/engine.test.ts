import { describe, expect, it } from "vitest";
import {
  applyMove,
  CRYSTAL_INDEXES,
  type CrystalIndex,
  type CrystalValues,
  createRng,
  DAILY_EPOCH,
  dailyPuzzle,
  dayNumber,
  generatePuzzle,
  hashSeed,
  isValidDay,
  MAX_MIN_CLICKS,
  MAX_MOVES,
  type Puzzle,
  puzzleFromSeed,
  randomInt,
  rate,
  replayWin,
  shiftDay,
  solve,
  startRound,
  TARGET_MAX,
  TARGET_MIN,
  trace,
  utcDay,
  VALUE_MAX,
  VALUE_MIN,
} from "./engine";

/** Independent, deliberately naive solver used to cross-check the DP. */
function bruteForceMinClicks(values: CrystalValues, target: number): number | null {
  let best: number | null = null;
  const walk = (index: number, remaining: number, clicks: number): void => {
    if (best !== null && clicks >= best) return;
    const value = values[index];
    if (value === undefined) {
      if (remaining === 0) best = clicks;
      return;
    }
    for (let count = 0; count * value <= remaining; count++) {
      walk(index + 1, remaining - count * value, clicks + count);
    }
  };
  walk(0, target, 0);
  return best;
}

const board = (target: number, values: CrystalValues): Puzzle => ({
  target,
  values,
  minClicks: solve(values, target)?.clicks ?? 0,
});

describe("seeded randomness", () => {
  it("replays the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it("matches the published mulberry32 reference output for seed 1", () => {
    const rng = createRng(1);
    expect([rng(), rng(), rng()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });

  it("keeps every draw inside [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("hashes strings to stable, well-spread seeds", () => {
    expect(hashSeed("")).toBe(2872998923);
    expect(hashSeed("abc")).toBe(482950588);
    expect(hashSeed("2026-10-25")).not.toBe(hashSeed("2026-10-26"));
  });

  it("includes both ends of the range (the original game never produced 12 or 120)", () => {
    const rng = createRng(99);
    const seen = new Set(Array.from({ length: 5_000 }, () => randomInt(rng, VALUE_MIN, VALUE_MAX)));
    expect(Math.min(...seen)).toBe(VALUE_MIN);
    expect(Math.max(...seen)).toBe(VALUE_MAX);
    expect(seen.size).toBe(VALUE_MAX - VALUE_MIN + 1);
  });
});

describe("solve (coin-change DP)", () => {
  it("finds the fewest clicks and a combination that adds up", () => {
    const solution = solve([3, 5, 7, 11], 19);
    expect(solution?.clicks).toBe(3);
    const counts = solution?.counts ?? [0, 0, 0, 0];
    const values: CrystalValues = [3, 5, 7, 11];
    expect(CRYSTAL_INDEXES.reduce<number>((sum, i) => sum + counts[i] * values[i], 0)).toBe(19);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("returns null when the board cannot be won", () => {
    expect(solve([6, 8, 10, 12], 19)).toBeNull();
    expect(solve([12, 12, 12, 12], 19)).toBeNull();
  });

  it("agrees with a brute-force search on 300 random boards", () => {
    const rng = createRng(2026);
    for (let i = 0; i < 300; i++) {
      const values: CrystalValues = [
        randomInt(rng, 1, 12),
        randomInt(rng, 1, 12),
        randomInt(rng, 1, 12),
        randomInt(rng, 1, 12),
      ];
      const target = randomInt(rng, TARGET_MIN, 60);
      expect(solve(values, target)?.clicks ?? null).toBe(bruteForceMinClicks(values, target));
    }
  });
});

describe("generatePuzzle", () => {
  const puzzles = Array.from({ length: 3_000 }, (_, i) => puzzleFromSeed(`property-${i}`));

  it("stays inside the documented ranges", () => {
    for (const { target, values } of puzzles) {
      expect(target).toBeGreaterThanOrEqual(TARGET_MIN);
      expect(target).toBeLessThanOrEqual(TARGET_MAX);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(VALUE_MIN);
        expect(value).toBeLessThanOrEqual(VALUE_MAX);
      }
    }
  });

  it("uses four different crystal values", () => {
    for (const { values } of puzzles) expect(new Set(values).size).toBe(4);
  });

  it("is always winnable and never needs more than the click cap", () => {
    for (const puzzle of puzzles) {
      const solution = solve(puzzle.values, puzzle.target);
      expect(solution).not.toBeNull();
      expect(puzzle.minClicks).toBe(solution?.clicks);
      expect(puzzle.minClicks).toBeLessThanOrEqual(MAX_MIN_CLICKS);
    }
  });

  it("reaches both extreme targets and the largest crystal value", () => {
    const targets = new Set(puzzles.map((p) => p.target));
    expect(targets.has(TARGET_MIN)).toBe(true);
    expect(targets.has(TARGET_MAX)).toBe(true);
    expect(puzzles.some((p) => p.values.includes(VALUE_MAX))).toBe(true);
  });

  it("is deterministic per seed", () => {
    expect(generatePuzzle(createRng(5))).toEqual(generatePuzzle(createRng(5)));
  });
});

describe("daily puzzle calendar", () => {
  it("pins known boards so a refactor cannot change a past day", () => {
    expect(dailyPuzzle("2026-10-25")).toEqual({ target: 45, values: [3, 10, 12, 2], minClicks: 5 });
    expect(dailyPuzzle("2026-10-26")).toEqual({ target: 27, values: [5, 1, 2, 9], minClicks: 3 });
    expect(dailyPuzzle("2026-12-31")).toEqual({ target: 83, values: [11, 3, 9, 8], minClicks: 8 });
    expect(dailyPuzzle("2028-02-29")).toEqual({ target: 85, values: [7, 5, 8, 4], minClicks: 11 });
  });

  it("numbers puzzles from the epoch", () => {
    expect(dayNumber(DAILY_EPOCH)).toBe(1);
    expect(dayNumber("2026-10-26")).toBe(2);
    expect(dayNumber("2027-02-28")).toBe(127);
  });

  it("validates real calendar days only", () => {
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("2027-02-29")).toBe(false);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(isValidDay("2026-1-1")).toBe(false);
    expect(isValidDay("not-a-day")).toBe(false);
  });

  it("formats a UTC day regardless of the local time zone", () => {
    expect(utcDay(new Date("2026-10-25T23:59:59Z"))).toBe("2026-10-25");
    expect(utcDay(new Date("2026-10-26T00:00:00Z"))).toBe("2026-10-26");
  });
});

describe("rounds", () => {
  const puzzle = board(30, [7, 5, 3, 11]);

  it("adds hidden values and reveals only the crystals that were clicked", () => {
    const round = applyMove(startRound(puzzle, "end"), 0);
    expect(round.score).toBe(7);
    expect(round.revealed).toEqual([true, false, false, false]);
    expect(round.status).toBe("playing");
  });

  it("wins on an exact match", () => {
    let round = startRound(board(19, [3, 5, 7, 11]), "end");
    for (const move of [3, 1, 0] as const) round = applyMove(round, move);
    expect(round.score).toBe(19);
    expect(round.status).toBe("won");
  });

  it("loses on a bust under the 'end' policy and then ignores further clicks", () => {
    let round = startRound(board(19, [3, 5, 7, 11]), "end");
    for (const move of [3, 3] as const) round = applyMove(round, move);
    expect(round.status).toBe("lost");
    expect(round.score).toBe(22);
    expect(applyMove(round, 0)).toBe(round);
  });

  it("resets the score and counts the bust under the 'reset' policy", () => {
    let round = startRound(board(19, [3, 5, 7, 11]), "reset");
    for (const move of [3, 3] as const) round = applyMove(round, move);
    expect(round.status).toBe("playing");
    expect(round.score).toBe(0);
    expect(round.busts).toBe(1);
    expect(round.moves).toEqual([3, 3]);
  });

  it("never mutates the previous round", () => {
    const before = startRound(puzzle, "end");
    applyMove(before, 1);
    expect(before.score).toBe(0);
    expect(before.moves).toEqual([]);
    expect(before.revealed).toEqual([false, false, false, false]);
  });

  it("flags busts in a per-click trace", () => {
    const steps = trace(board(19, [3, 5, 7, 11]), [3, 3, 3, 1, 0], "reset");
    expect(steps.map((s) => s.bust)).toEqual([false, true, false, false, false]);
  });
});

describe("replayWin", () => {
  const puzzle = board(19, [3, 5, 7, 11]);
  const winning: CrystalIndex[] = [3, 1, 0];

  it("accepts a genuine winning run", () => {
    const result = replayWin(puzzle, winning);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.round.moves).toEqual(winning);
  });

  it("accepts a win that includes busts under the daily rules", () => {
    const result = replayWin(puzzle, [3, 3, ...winning]);
    expect(result.ok && result.round.busts).toBe(1);
  });

  it("rejects runs that do not end in a win", () => {
    expect(replayWin(puzzle, [0, 1])).toEqual({ ok: false, reason: "unfinished" });
    expect(replayWin(puzzle, [])).toEqual({ ok: false, reason: "unfinished" });
  });

  it("rejects clicks after the win", () => {
    expect(replayWin(puzzle, [...winning, 0])).toEqual({ ok: false, reason: "moves-after-end" });
  });

  it.each([[4], [-1], [1.5], ["1"], [null], [undefined], [Number.NaN]])(
    "rejects the invalid move %j",
    (move) => {
      expect(replayWin(puzzle, [move])).toEqual({ ok: false, reason: "invalid-move" });
    },
  );

  it("rejects absurdly long runs before replaying them", () => {
    const tooMany = Array.from({ length: MAX_MOVES + 1 }, () => 0);
    expect(replayWin(puzzle, tooMany)).toEqual({ ok: false, reason: "too-many-moves" });
  });
});

describe("rate", () => {
  it("grades by clicks beyond the minimum", () => {
    expect(rate(5, 5)).toBe("crystal-clear");
    expect(rate(7, 5)).toBe("crystal-clear");
    expect(rate(8, 5)).toBe("sharp");
    expect(rate(10, 5)).toBe("sharp");
    expect(rate(11, 5)).toBe("solved");
  });
});

describe("shiftDay", () => {
  it("moves across month, year and leap-day boundaries", () => {
    expect(shiftDay("2026-10-25", 1)).toBe("2026-10-26");
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDay("2026-10-25", 0)).toBe("2026-10-25");
  });
});
