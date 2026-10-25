import {
  applyMove,
  type BustPolicy,
  type CrystalIndex,
  classicPuzzle,
  dailyPuzzle,
  type Puzzle,
  type Round,
  shiftDay,
  startRound,
} from "../../shared/engine";
import type { ClassicTotals, DailyTotals } from "./persistence";

export type Mode = "daily" | "classic";

export interface GameState {
  readonly mode: Mode;
  /** Today's UTC day, which selects the daily puzzle. */
  readonly day: string;
  readonly daily: Round;
  /** Identifies the classic board; the same id always deals the same board. */
  readonly board: string;
  readonly classic: Round;
  readonly classicTotals: ClassicTotals;
  readonly dailyTotals: DailyTotals;
}

export type Action =
  | { readonly type: "click"; readonly crystal: CrystalIndex }
  | { readonly type: "mode"; readonly mode: Mode }
  | { readonly type: "new-classic-board"; readonly board: string };

export const DAILY_POLICY: BustPolicy = "reset";
export const CLASSIC_POLICY: BustPolicy = "end";

export function roundFromMoves(
  puzzle: Puzzle,
  policy: BustPolicy,
  moves: readonly CrystalIndex[],
): Round {
  return moves.reduce(applyMove, startRound(puzzle, policy));
}

export interface InitialInput {
  readonly mode: Mode;
  readonly day: string;
  readonly board: string;
  readonly dailyMoves: readonly CrystalIndex[];
  readonly classicTotals: ClassicTotals;
  readonly dailyTotals: DailyTotals;
}

export function initialState(input: InitialInput): GameState {
  return {
    mode: input.mode,
    day: input.day,
    daily: roundFromMoves(dailyPuzzle(input.day), DAILY_POLICY, input.dailyMoves),
    board: input.board,
    classic: startRound(classicPuzzle(input.board), CLASSIC_POLICY),
    classicTotals: input.classicTotals,
    dailyTotals: input.dailyTotals,
  };
}

function afterDailyWin(totals: DailyTotals, day: string): DailyTotals {
  if (totals.lastWonDay === day) return totals;
  const streak = totals.lastWonDay === shiftDay(day, -1) ? totals.streak + 1 : 1;
  return {
    played: totals.played + 1,
    streak,
    bestStreak: Math.max(totals.bestStreak, streak),
    lastWonDay: day,
  };
}

function afterClassicResult(totals: ClassicTotals, round: Round): ClassicTotals {
  if (round.status === "won") {
    const streak = totals.streak + 1;
    return {
      ...totals,
      wins: totals.wins + 1,
      streak,
      bestStreak: Math.max(totals.bestStreak, streak),
    };
  }
  return { ...totals, losses: totals.losses + 1, streak: 0 };
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "mode":
      return { ...state, mode: action.mode };

    case "new-classic-board":
      return {
        ...state,
        board: action.board,
        classic: startRound(classicPuzzle(action.board), CLASSIC_POLICY),
      };

    case "click": {
      if (state.mode === "daily") {
        const daily = applyMove(state.daily, action.crystal);
        if (daily === state.daily) return state;
        const justWon = daily.status === "won";
        return {
          ...state,
          daily,
          dailyTotals: justWon ? afterDailyWin(state.dailyTotals, state.day) : state.dailyTotals,
        };
      }

      const classic = applyMove(state.classic, action.crystal);
      if (classic === state.classic) return state;
      return {
        ...state,
        classic,
        classicTotals:
          classic.status === "playing"
            ? state.classicTotals
            : afterClassicResult(state.classicTotals, classic),
      };
    }
  }
}
