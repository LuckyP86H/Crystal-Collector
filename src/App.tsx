import { useEffect, useEffectEvent, useRef, useState } from "react";
import { CRYSTAL_INDEXES, type CrystalIndex, dayNumber, trace, utcDay } from "../shared/engine";
import { CrystalButton } from "./components/CrystalButton";
import { HelpDialog } from "./components/HelpDialog";
import { ResultDialog, type ResultView } from "./components/ResultDialog";
import { Scoreboard } from "./components/Scoreboard";
import { CRYSTALS } from "./game/crystals";
import { loadFlag, loadPlayerId, saveFlag } from "./game/persistence";
import { reduce } from "./game/state";
import { boardUrl, newBoardId, useGame } from "./game/useGame";
import { useLeaderboard } from "./game/useLeaderboard";
import { playBust, playClick, playWin, setMuted } from "./lib/sound";

const RESULT_DELAY_MS = 700;

function vibrate(pattern: number | number[]): void {
  if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

export function App() {
  const [state, dispatch] = useGame();
  const [playerId] = useState(() => loadPlayerId());
  const [soundOff, setSoundOff] = useState(() => loadFlag("muted"));
  const [helpOpen, setHelpOpen] = useState(() => !loadFlag("seen-help"));
  const [resultOpen, setResultOpen] = useState(false);
  const [lastPick, setLastPick] = useState<{ index: CrystalIndex; n: number } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const resultTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const round = state.mode === "daily" ? state.daily : state.classic;
  const { puzzle } = round;
  const [leaderboard, retryLeaderboard] = useLeaderboard(state.day, playerId, state.daily);
  const finished = round.status !== "playing";

  useEffect(() => setMuted(soundOff), [soundOff]);
  useEffect(() => () => clearTimeout(resultTimer.current), []);

  // A tab left open past 00:00 UTC keeps yesterday's puzzle. Refresh it once the player is looking
  // at the Daily board; a Classic round in progress is left alone.
  useEffect(() => {
    const onVisible = () => {
      const stale = utcDay(new Date()) !== state.day;
      if (document.visibilityState === "visible" && state.mode === "daily" && stale) {
        window.location.reload();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [state.day, state.mode]);

  function pick(crystal: CrystalIndex) {
    const next = reduce(state, { type: "click", crystal });
    const after = state.mode === "daily" ? next.daily : next.classic;
    if (after === round) return;

    dispatch({ type: "click", crystal });
    playClick(CRYSTALS[crystal].hz);
    setLastPick({ index: crystal, n: after.moves.length });

    const busted = after.busts > round.busts || after.status === "lost";
    const gained = puzzle.values[crystal];
    let message = `${CRYSTALS[crystal].label} adds ${gained}. Score ${after.score} of ${puzzle.target}.`;

    if (busted) {
      vibrate([30, 40, 30]);
      setShakeKey((key) => key + 1);
      window.setTimeout(playBust, 140);
      message = `${CRYSTALS[crystal].label} adds ${gained}. Bust! ${
        after.status === "lost" ? "Round lost." : "Score reset to zero."
      }`;
    } else if (after.status === "won") {
      vibrate([20, 30, 20, 30, 60]);
      window.setTimeout(playWin, 140);
      message = `${CRYSTALS[crystal].label} adds ${gained}. You hit ${puzzle.target}! You win.`;
    } else {
      vibrate(8);
    }
    setAnnouncement(message);

    if (after.status !== "playing") {
      clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => setResultOpen(true), RESULT_DELAY_MS);
    }
  }

  // Keyboard shortcuts: 1-4 pick a crystal, ? opens the help. An Effect Event always sees the
  // latest state, so the single listener below can never act on a stale render.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (helpOpen || resultOpen) return;
    if (event.key === "?") {
      setHelpOpen(true);
      return;
    }
    const crystal = CRYSTAL_INDEXES.find((candidate) => candidate === Number(event.key) - 1);
    if (crystal !== undefined && !finished) pick(crystal);
  });

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function switchMode(mode: "daily" | "classic") {
    if (mode === "daily" && utcDay(new Date()) !== state.day) {
      window.location.assign("/");
      return;
    }
    clearTimeout(resultTimer.current);
    setResultOpen(false);
    setLastPick(null);
    setAnnouncement("");
    dispatch({ type: "mode", mode });
  }

  function playAgain() {
    clearTimeout(resultTimer.current);
    setResultOpen(false);
    setLastPick(null);
    setAnnouncement("New round. Pick a crystal.");
    dispatch({ type: "new-classic-board", board: newBoardId() });
  }

  function toggleSound() {
    setSoundOff(!soundOff);
    saveFlag("muted", !soundOff);
  }

  function closeHelp() {
    saveFlag("seen-help", true);
    setHelpOpen(false);
  }

  const steps = trace(puzzle, round.moves, round.policy);
  const view: ResultView =
    state.mode === "daily"
      ? {
          kind: "daily",
          round: state.daily,
          number: dayNumber(state.day),
          leaderboard,
          onRetry: retryLeaderboard,
        }
      : {
          kind: "classic",
          round: state.classic,
          boardUrl: boardUrl(state.board),
          onPlayAgain: playAgain,
        };

  const label =
    state.mode === "daily"
      ? `Daily puzzle #${dayNumber(state.day)} · ${formatDay(state.day)}`
      : `Classic · board ${state.board}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">💎 Crystal Collector</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={!soundOff}
            aria-label="Sound"
            className="grid size-11 place-items-center rounded-full border border-line bg-surface text-lg"
          >
            <span aria-hidden="true">{soundOff ? "🔇" : "🔊"}</span>
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="How to play"
            aria-keyshortcuts="?"
            className="grid size-11 place-items-center rounded-full border border-line bg-surface text-lg font-semibold"
          >
            <span aria-hidden="true">?</span>
          </button>
        </div>
      </header>

      <nav
        aria-label="Game mode"
        className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1"
      >
        {(["daily", "classic"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={state.mode === mode}
            onClick={() => switchMode(mode)}
            className="rounded-xl px-4 py-2.5 text-lg font-medium capitalize text-muted aria-pressed:bg-accent aria-pressed:text-accent-ink"
          >
            {mode}
          </button>
        ))}
      </nav>

      <main className="flex flex-col gap-5">
        <Scoreboard
          label={label}
          target={puzzle.target}
          score={round.score}
          over={round.score > puzzle.target}
          busts={state.mode === "daily" ? round.busts : 0}
          shakeKey={shakeKey}
        />

        <fieldset className="m-0 grid min-w-0 grid-cols-2 gap-3 border-0 p-0 sm:grid-cols-4">
          <legend className="sr-only">Crystals</legend>
          {CRYSTAL_INDEXES.map((index) => (
            <CrystalButton
              key={index}
              index={index}
              value={round.revealed[index] ? puzzle.values[index] : null}
              disabled={finished}
              pick={lastPick?.index === index ? { n: lastPick.n } : null}
              onPick={pick}
            />
          ))}
        </fieldset>

        {finished ? (
          <button
            type="button"
            onClick={() => (state.mode === "classic" ? playAgain() : setResultOpen(true))}
            className="animate-rise-in rounded-2xl bg-accent px-4 py-3 text-lg font-semibold text-accent-ink"
          >
            {state.mode === "classic" ? "Play again" : "View your result"}
          </button>
        ) : null}

        <section aria-label="Your clicks" className="rounded-3xl border border-line bg-surface p-4">
          <h2 className="text-sm font-medium text-muted">
            Your clicks{round.moves.length > 0 ? ` (${round.moves.length})` : ""}
          </h2>
          {steps.length === 0 ? (
            <p className="mt-2 text-muted">Click a crystal to begin.</p>
          ) : (
            <ol className="mt-3 flex flex-wrap gap-2">
              {steps.map((step, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: clicks are append-only and have no id
                  key={i}
                  className="crystal grid size-8 place-items-center rounded-full bg-(--gem) text-sm"
                  data-gem={CRYSTALS[step.move].colour}
                  title={`${CRYSTALS[step.move].label}${step.bust ? ": bust" : ""}`}
                >
                  {step.bust ? <span aria-hidden="true">💥</span> : null}
                  <span className="sr-only">
                    {CRYSTALS[step.move].label}
                    {step.bust ? ", bust" : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <Totals state={state} />
      </main>

      <footer className="mt-auto pt-4 text-center text-sm text-muted">
        Rebuilt in 2026 from a 2019 bootcamp project ·{" "}
        <a
          className="underline"
          href="https://github.com/LuckyP86H/Crystal-Collector"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      </footer>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <HelpDialog open={helpOpen} onClose={closeHelp} />
      <ResultDialog open={resultOpen} onClose={() => setResultOpen(false)} view={view} />
    </div>
  );
}

type TotalsItem = readonly [label: string, value: number];

function Totals({ state }: { state: ReturnType<typeof useGame>[0] }) {
  const items: readonly TotalsItem[] =
    state.mode === "daily"
      ? [
          ["Streak", state.dailyTotals.streak],
          ["Best streak", state.dailyTotals.bestStreak],
          ["Solved", state.dailyTotals.played],
        ]
      : [
          ["Wins", state.classicTotals.wins],
          ["Losses", state.classicTotals.losses],
          ["Streak", state.classicTotals.streak],
          ["Best streak", state.classicTotals.bestStreak],
        ];
  return (
    <section aria-label="Your totals">
      <dl
        className={`grid gap-3 text-center ${items.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}
      >
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface px-2 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd
              data-testid={`total-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-2xl font-semibold"
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
