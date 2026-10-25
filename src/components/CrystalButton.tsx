import type { CrystalIndex } from "../../shared/engine";
import { CRYSTALS } from "../game/crystals";
import { Gem } from "./Gem";

interface Props {
  readonly index: CrystalIndex;
  /** The crystal's value once the player has clicked it; null while still hidden. */
  readonly value: number | null;
  readonly disabled: boolean;
  /** Set only for the crystal the player just clicked; a new `n` replays the animations. */
  readonly pick: { readonly n: number } | null;
  readonly onPick: (index: CrystalIndex) => void;
}

export function CrystalButton({ index, value, disabled, pick, onPick }: Props) {
  const crystal = CRYSTALS[index];
  const hidden = value === null;

  return (
    <div className="relative">
      <button
        type="button"
        className="crystal relative flex h-full w-full flex-col items-center gap-3 rounded-3xl border border-line bg-surface px-3 pb-4 pt-6 transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
        data-gem={crystal.colour}
        disabled={disabled}
        onClick={() => onPick(index)}
        aria-label={`${crystal.label}, ${hidden ? "value hidden" : `adds ${value}`}`}
        aria-keyshortcuts={String(index + 1)}
      >
        <span key={pick ? `pop-${pick.n}` : "idle"} className={pick ? "animate-pop" : undefined}>
          <Gem cut={crystal.cut} className="gem-glow size-20 sm:size-24" />
        </span>
        <span
          className="rounded-full border border-line bg-surface-strong px-3 py-1 text-lg font-semibold tabular-nums"
          aria-hidden="true"
        >
          {hidden ? "?" : `+${value}`}
        </span>
        {pick && !hidden ? (
          <span
            key={`gain-${pick.n}`}
            className="animate-float-up pointer-events-none absolute left-1/2 top-4 text-2xl font-bold text-(--gem-light)"
            aria-hidden="true"
          >
            +{value}
          </span>
        ) : null}
      </button>
      <span
        className="pointer-events-none absolute left-3 top-3 hidden rounded-md border border-line px-1.5 text-xs text-muted pointer-fine:block"
        aria-hidden="true"
      >
        {index + 1}
      </span>
    </div>
  );
}
