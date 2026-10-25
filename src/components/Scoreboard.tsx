interface Props {
  readonly label: string;
  readonly target: number;
  readonly score: number;
  /** True when the score passed the target (a lost Classic round). */
  readonly over: boolean;
  readonly busts: number;
  /** Changes on every bust so the shake animation replays. */
  readonly shakeKey: number;
}

export function Scoreboard({ label, target, score, over, busts, shakeKey }: Props) {
  return (
    <section aria-label="Scoreboard" className="rounded-3xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted">Target</p>
          <p data-testid="target" className="text-6xl font-semibold leading-none">
            {target}
          </p>
        </div>
        <div key={shakeKey} className={shakeKey > 0 ? "animate-shake" : undefined}>
          <p className="text-sm text-muted">Your score</p>
          <p
            data-testid="score"
            className={`text-6xl font-semibold leading-none ${over ? "text-bad" : ""}`}
          >
            {score}
          </p>
        </div>
      </div>
      <progress
        className="meter mt-5"
        aria-label="Progress towards the target"
        max={target}
        value={Math.min(score, target)}
        data-over={over}
      />
      {busts > 0 ? (
        <p data-testid="busts" className="mt-3 text-sm text-bad">
          💥 {busts} {busts === 1 ? "bust" : "busts"}: score reset each time
        </p>
      ) : null}
    </section>
  );
}
