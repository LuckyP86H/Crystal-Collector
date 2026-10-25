import { describe, expect, it } from "vitest";
import { type CrystalIndex, classicPuzzle, dailyPuzzle, routeOf, solve } from "../../shared/engine";
import { EMPTY_CLASSIC_TOTALS, EMPTY_DAILY_TOTALS } from "./persistence";
import { type GameState, initialState, type Mode, reduce, roundFromMoves } from "./state";

const DAY = "2026-10-25";
const BOARD = "test-board";

function start(overrides: Partial<Parameters<typeof initialState>[0]> = {}): GameState {
  return initialState({
    mode: "daily",
    day: DAY,
    board: BOARD,
    dailyMoves: [],
    classicTotals: EMPTY_CLASSIC_TOTALS,
    dailyTotals: EMPTY_DAILY_TOTALS,
    ...overrides,
  });
}

function winningRoute(puzzle: {
  values: readonly [number, number, number, number];
  target: number;
}) {
  const solution = solve(puzzle.values, puzzle.target);
  if (!solution) throw new Error("expected a winnable board");
  return routeOf(solution);
}

function play(state: GameState, moves: readonly CrystalIndex[]): GameState {
  return moves.reduce((next, crystal) => reduce(next, { type: "click", crystal }), state);
}

/** A first click that cannot win on its own, followed by clicks that overshoot the target. */
function bustingRoute(puzzle: {
  values: readonly [number, number, number, number];
  target: number;
}) {
  const biggest = ([0, 1, 2, 3] as const).reduce((best, i) =>
    puzzle.values[i] > puzzle.values[best] ? i : best,
  );
  return Array.from(
    { length: Math.floor(puzzle.target / puzzle.values[biggest]) + 1 },
    () => biggest,
  );
}

describe("initialState", () => {
  it("restores a half-finished daily round from saved clicks", () => {
    const route = winningRoute(dailyPuzzle(DAY));
    const state = start({ dailyMoves: route.slice(0, 2) });
    expect(state.daily.moves).toEqual(route.slice(0, 2));
    expect(state.daily.status).toBe("playing");
  });

  it("restores a finished daily round", () => {
    const route = winningRoute(dailyPuzzle(DAY));
    expect(start({ dailyMoves: route }).daily.status).toBe("won");
  });

  it("deals the same classic board for the same id", () => {
    expect(start().classic.puzzle).toEqual(classicPuzzle(BOARD));
    expect(classicPuzzle(BOARD)).toEqual(classicPuzzle(BOARD));
    expect(classicPuzzle("another")).not.toEqual(classicPuzzle(BOARD));
  });
});

describe("daily mode", () => {
  it("records a win once and starts a streak", () => {
    const route = winningRoute(dailyPuzzle(DAY));
    const state = play(start(), route);
    expect(state.daily.status).toBe("won");
    expect(state.dailyTotals).toEqual({ played: 1, streak: 1, bestStreak: 1, lastWonDay: DAY });
  });

  it("does not count anything after the puzzle is solved", () => {
    const route = winningRoute(dailyPuzzle(DAY));
    const won = play(start(), route);
    expect(reduce(won, { type: "click", crystal: 0 })).toBe(won);
  });

  it("continues a streak from yesterday and restarts it after a gap", () => {
    const route = winningRoute(dailyPuzzle(DAY));
    const yesterday = { played: 5, streak: 4, bestStreak: 6, lastWonDay: "2026-10-24" };
    expect(play(start({ dailyTotals: yesterday }), route).dailyTotals).toEqual({
      played: 6,
      streak: 5,
      bestStreak: 6,
      lastWonDay: DAY,
    });

    const longAgo = { played: 5, streak: 4, bestStreak: 6, lastWonDay: "2026-10-20" };
    expect(play(start({ dailyTotals: longAgo }), route).dailyTotals).toMatchObject({
      streak: 1,
      bestStreak: 6,
    });
  });

  it("resets the score on a bust but keeps playing the same board", () => {
    const puzzle = dailyPuzzle(DAY);
    const state = play(start(), bustingRoute(puzzle));
    expect(state.daily.status).toBe("playing");
    expect(state.daily.busts).toBe(1);
    expect(state.daily.score).toBe(0);
    expect(state.dailyTotals).toEqual(EMPTY_DAILY_TOTALS);
  });
});

describe("classic mode", () => {
  const classic = () => start({ mode: "classic" as Mode });

  it("counts a win and extends the streak", () => {
    const route = winningRoute(classicPuzzle(BOARD));
    const state = play(classic(), route);
    expect(state.classic.status).toBe("won");
    expect(state.classicTotals).toEqual({ wins: 1, losses: 0, streak: 1, bestStreak: 1 });
  });

  it("counts a loss and ends the streak", () => {
    const seeded = start({
      mode: "classic",
      classicTotals: { wins: 2, losses: 0, streak: 2, bestStreak: 2 },
    });
    const state = play(seeded, bustingRoute(classicPuzzle(BOARD)));
    expect(state.classic.status).toBe("lost");
    expect(state.classicTotals).toEqual({ wins: 2, losses: 1, streak: 0, bestStreak: 2 });
  });

  it("ignores clicks once the round is over", () => {
    const lost = play(classic(), bustingRoute(classicPuzzle(BOARD)));
    expect(reduce(lost, { type: "click", crystal: 1 })).toBe(lost);
  });

  it("deals a fresh round on a new board without touching the totals", () => {
    const lost = play(classic(), bustingRoute(classicPuzzle(BOARD)));
    const next = reduce(lost, { type: "new-classic-board", board: "next-board" });
    expect(next.board).toBe("next-board");
    expect(next.classic.status).toBe("playing");
    expect(next.classic.moves).toEqual([]);
    expect(next.classicTotals).toEqual(lost.classicTotals);
  });
});

describe("mode switching", () => {
  it("keeps both rounds intact", () => {
    const afterClick = reduce(start(), { type: "click", crystal: 0 });
    const switched = reduce(afterClick, { type: "mode", mode: "classic" });
    expect(switched.mode).toBe("classic");
    expect(switched.daily).toBe(afterClick.daily);
    expect(roundFromMoves(dailyPuzzle(DAY), "reset", [0])).toEqual(afterClick.daily);
  });
});
