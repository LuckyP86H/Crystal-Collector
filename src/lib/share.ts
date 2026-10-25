import { type Counts, CRYSTAL_INDEXES, type Rating, type Step } from "../../shared/engine";
import { CRYSTALS } from "../game/crystals";

export const RATING_LABEL: Readonly<Record<Rating, string>> = {
  "crystal-clear": "Crystal clear",
  sharp: "Sharp",
  solved: "Solved",
};

export interface ShareInput {
  readonly number: number;
  readonly clicks: number;
  readonly minClicks: number;
  readonly busts: number;
  readonly rating: Rating;
  readonly steps: readonly Step[];
  readonly url: string;
}

const GRID_ROW_LENGTH = 10;

/** One emoji per click, in the colour of the crystal, with 💥 where the score busted. */
export function shareGrid(steps: readonly Step[]): string {
  const cells = steps.map((step) => (step.bust ? "💥" : CRYSTALS[step.move].emoji));
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += GRID_ROW_LENGTH) {
    rows.push(cells.slice(i, i + GRID_ROW_LENGTH).join(""));
  }
  return rows.join("\n");
}

export function pluralise(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function buildShareText(input: ShareInput): string {
  const summary = [
    RATING_LABEL[input.rating],
    `${pluralise(input.clicks, "click")} (min ${input.minClicks})`,
    ...(input.busts > 0 ? [pluralise(input.busts, "bust")] : []),
  ].join(" · ");
  return [`💎 Crystal Collector #${input.number}`, summary, shareGrid(input.steps), input.url].join(
    "\n",
  );
}

/** "3× 🟦 + 2× 🟥": how many times to click each crystal on a shortest route. */
export function describeRoute(counts: Counts): string {
  return CRYSTAL_INDEXES.filter((crystal) => counts[crystal] > 0)
    .map((crystal) => `${counts[crystal]}× ${CRYSTALS[crystal].emoji}`)
    .join(" + ");
}
