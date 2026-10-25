import { useEffect, useReducer } from "react";
import { utcDay } from "../../shared/engine";
import {
  loadClassicTotals,
  loadDailyMoves,
  loadDailyTotals,
  saveClassicTotals,
  saveDailyMoves,
  saveDailyTotals,
} from "./persistence";
import { type Action, type GameState, initialState, type Mode, reduce } from "./state";

const BOARD_ID = /^[a-z0-9_-]{1,32}$/i;

export function newBoardId(): string {
  const [random = 0] = crypto.getRandomValues(new Uint32Array(1));
  return random.toString(36).padStart(7, "0").slice(-6);
}

function createInitialState(): GameState {
  const params = new URLSearchParams(window.location.search);
  const day = utcDay(new Date());
  const board = params.get("board");
  return initialState({
    mode: params.get("mode") === "classic" ? "classic" : "daily",
    day,
    board: board && BOARD_ID.test(board) ? board : newBoardId(),
    dailyMoves: loadDailyMoves(day),
    classicTotals: loadClassicTotals(),
    dailyTotals: loadDailyTotals(),
  });
}

export function boardUrl(board: string): string {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("mode", "classic");
  url.searchParams.set("board", board);
  return url.toString();
}

function syncUrl(mode: Mode, board: string): void {
  const next = mode === "classic" ? `/?mode=classic&board=${board}` : "/";
  if (`${window.location.pathname}${window.location.search}` !== next) {
    window.history.replaceState(null, "", next);
  }
}

/** Game state plus persistence: every change is saved, and the URL mirrors the Classic board. */
export function useGame(): readonly [GameState, (action: Action) => void] {
  const [state, dispatch] = useReducer(reduce, undefined, createInitialState);

  useEffect(() => saveDailyMoves(state.day, state.daily.moves), [state.day, state.daily.moves]);
  useEffect(() => saveClassicTotals(state.classicTotals), [state.classicTotals]);
  useEffect(() => saveDailyTotals(state.dailyTotals), [state.dailyTotals]);
  useEffect(() => syncUrl(state.mode, state.board), [state.mode, state.board]);

  return [state, dispatch];
}
