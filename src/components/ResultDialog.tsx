import { useState } from "react";
import type { DailyStats } from "../../shared/api";
import { type Round, rate, solve, trace } from "../../shared/engine";
import { shareText } from "../lib/clipboard";
import { formatCountdown, msUntilNextPuzzle } from "../lib/countdown";
import { buildShareText, describeRoute, pluralise, RATING_LABEL, shareGrid } from "../lib/share";
import { useNow } from "../lib/useNow";
import { Dialog } from "./Dialog";
import { Histogram } from "./Histogram";

export type Leaderboard =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly stats: DailyStats }
  | { readonly status: "offline" };

export type ResultView =
  | {
      readonly kind: "daily";
      readonly round: Round;
      readonly number: number;
      readonly leaderboard: Leaderboard;
      readonly onRetry: () => void;
    }
  | {
      readonly kind: "classic";
      readonly round: Round;
      readonly boardUrl: string;
      readonly onPlayAgain: () => void;
    };

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly view: ResultView;
}

const primaryButton = "rounded-2xl bg-accent px-4 py-3 text-lg font-semibold text-accent-ink";
const secondaryButton = "rounded-2xl border border-line bg-surface px-4 py-3 text-lg font-semibold";

export function ResultDialog({ open, onClose, view }: Props) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="result-title">
      {view.kind === "daily" ? (
        <DailyResult view={view} onClose={onClose} />
      ) : (
        <ClassicResult view={view} onClose={onClose} />
      )}
    </Dialog>
  );
}

function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className: string;
}) {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          const outcome = await shareText(text);
          setMessage(outcome === "failed" ? "Couldn't copy. Select the text instead." : "Copied!");
        }}
      >
        {label}
      </button>
      <output className="sr-only" aria-live="polite">
        {message}
      </output>
      {message ? (
        <span className="self-center text-sm text-muted" aria-hidden="true">
          {message}
        </span>
      ) : null}
    </>
  );
}

function DailyResult({
  view,
  onClose,
}: {
  view: Extract<ResultView, { kind: "daily" }>;
  onClose: () => void;
}) {
  const { round, leaderboard } = view;
  const now = useNow();
  const clicks = round.moves.length;
  const { minClicks } = round.puzzle;
  const rating = rate(clicks, minClicks);
  const steps = trace(round.puzzle, round.moves, round.policy);
  const text = buildShareText({
    number: view.number,
    clicks,
    minClicks,
    busts: round.busts,
    rating,
    steps,
    url: `${window.location.origin}/`,
  });
  const route = solve(round.puzzle.values, round.puzzle.target);

  return (
    <>
      <h2 id="result-title" className="text-2xl font-semibold">
        Puzzle #{view.number} solved 🎉
      </h2>
      <p className="mt-1 text-lg font-medium text-good">{RATING_LABEL[rating]}</p>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Clicks" value={clicks} />
        <Stat label="Fewest possible" value={minClicks} />
        <Stat label="Busts" value={round.busts} />
      </dl>

      <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-surface-strong p-4 text-center text-2xl leading-relaxed">
        <span className="sr-only">Your result: </span>
        {shareGrid(steps)}
      </pre>
      {route ? (
        <p className="mt-3 text-sm text-muted">
          A shortest route: <span className="text-ink">{describeRoute(route.counts)}</span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <CopyButton text={text} label="Share result" className={primaryButton} />
      </div>

      <section aria-labelledby="board-title" className="mt-6">
        <h3 id="board-title" className="text-lg font-semibold">
          Today's players
        </h3>
        <Standings leaderboard={leaderboard} onRetry={view.onRetry} />
      </section>

      <p className="mt-6 text-sm text-muted">
        Next puzzle in{" "}
        <time className="font-semibold tabular-nums text-ink">
          {formatCountdown(msUntilNextPuzzle(now))}
        </time>
      </p>
      <button type="button" onClick={onClose} className={`${secondaryButton} mt-4 w-full`}>
        Close
      </button>
    </>
  );
}

function Standings({ leaderboard, onRetry }: { leaderboard: Leaderboard; onRetry: () => void }) {
  if (leaderboard.status === "idle" || leaderboard.status === "loading") {
    return <p className="mt-2 text-muted">Checking the leaderboard…</p>;
  }
  if (leaderboard.status === "offline") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-3 text-muted">
        <p>The leaderboard is unreachable right now.</p>
        <button type="button" className="underline" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  const { stats } = leaderboard;
  return (
    <>
      <p className="mt-2 text-muted">
        {stats.you ? (
          <>
            Your best today:{" "}
            <strong className="text-ink">{pluralise(stats.you.clicks, "click")}</strong>, ranked{" "}
            <strong className="text-ink">#{stats.you.rank}</strong> of {stats.players}.
          </>
        ) : (
          `${pluralise(stats.players, "player")} so far.`
        )}
      </p>
      <div className="mt-3 max-h-48 overflow-y-auto">
        <Histogram stats={stats} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function ClassicResult({
  view,
  onClose,
}: {
  view: Extract<ResultView, { kind: "classic" }>;
  onClose: () => void;
}) {
  const { round } = view;
  const won = round.status === "won";
  const route = solve(round.puzzle.values, round.puzzle.target);

  return (
    <>
      <h2 id="result-title" className="text-2xl font-semibold">
        {won ? "You won! 🎉" : "Bust! 💥"}
      </h2>
      <p className="mt-2 text-lg">
        {won
          ? `You hit ${round.puzzle.target} in ${pluralise(round.moves.length, "click")}.`
          : `You reached ${round.score}, past the target of ${round.puzzle.target}.`}
      </p>
      {route ? (
        <p className="mt-2 text-muted">
          The fewest clicks possible was <strong className="text-ink">{route.clicks}</strong>:{" "}
          <span className="text-ink">{describeRoute(route.counts)}</span>
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className={primaryButton} onClick={view.onPlayAgain}>
          Play again
        </button>
        <CopyButton text={view.boardUrl} label="Copy board link" className={secondaryButton} />
      </div>
      <button type="button" onClick={onClose} className="mt-4 text-sm text-muted underline">
        Close
      </button>
    </>
  );
}
