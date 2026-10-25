import { Dialog } from "./Dialog";

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function HelpDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="help-title">
      <h2 id="help-title" className="text-2xl font-semibold">
        How to play
      </h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-muted marker:text-accent">
        <li>
          <strong className="text-ink">Match the target exactly.</strong> Click crystals to add to
          your score until it equals the target number.
        </li>
        <li>
          <strong className="text-ink">Values are hidden.</strong> Each crystal is worth 1 to 12.
          You only see its value after you click it, and it keeps that value for the whole round.
        </li>
        <li>
          <strong className="text-ink">Don't go over.</strong> In Classic a bust loses the round. In
          Daily your score resets to zero, but every click still counts.
        </li>
        <li>
          <strong className="text-ink">Every board can be won.</strong> Daily is the same board for
          everyone and changes at 00:00 UTC. Fewer clicks is better.
        </li>
      </ol>
      <p className="mt-4 text-sm text-muted">
        Keyboard: <kbd className="rounded border border-line px-1">1</kbd>–
        <kbd className="rounded border border-line px-1">4</kbd> pick a crystal,{" "}
        <kbd className="rounded border border-line px-1">?</kbd> opens this help.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full rounded-2xl bg-accent px-4 py-3 text-lg font-semibold text-accent-ink"
      >
        Got it
      </button>
    </Dialog>
  );
}
