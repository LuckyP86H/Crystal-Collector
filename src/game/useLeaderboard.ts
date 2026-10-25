import { useCallback, useEffect, useState } from "react";
import type { Round } from "../../shared/engine";
import type { Leaderboard } from "../components/ResultDialog";
import { submitRun } from "../lib/api";

/**
 * Posts the finished daily run and keeps the response. Submitting is idempotent
 * on the server (it keeps a player's best run), so re-posting after a reload or
 * a failed attempt is safe and doubles as the retry.
 */
export function useLeaderboard(
  day: string,
  playerId: string,
  round: Round,
): readonly [Leaderboard, () => void] {
  const [board, setBoard] = useState<Leaderboard>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const won = round.status === "won";
  const moves = round.moves;

  // `attempt` is deliberately listed: bumping it re-runs the effect to retry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!won) return;
    const controller = new AbortController();
    setBoard({ status: "loading" });
    submitRun(day, playerId, moves, controller.signal).then((stats) => {
      if (!controller.signal.aborted) {
        setBoard(stats ? { status: "ready", stats } : { status: "offline" });
      }
    });
    return () => controller.abort();
  }, [won, day, playerId, moves, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return [board, retry];
}
