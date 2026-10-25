import { test as base, expect, type Page } from "@playwright/test";
import {
  applyMove,
  type BustPolicy,
  CRYSTAL_INDEXES,
  type CrystalIndex,
  type Puzzle,
  routeOf,
  solve,
  startRound,
  utcDay,
} from "../shared/engine";

interface Options {
  /** Console output that a test expects, such as a request it blocks on purpose. */
  allowedProblem: RegExp | undefined;
}

/** Every test fails if the page logs a console error or warning, or throws. */
export const test = base.extend<Options>({
  allowedProblem: [undefined, { option: true }],
  page: async ({ page, allowedProblem }, use) => {
    const problems: string[] = [];
    const record = (text: string) => {
      if (!allowedProblem?.test(text)) problems.push(text);
    };
    page.on("pageerror", (error) => record(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        record(`console.${message.type()}: ${message.text()}`);
      }
    });
    await use(page);
    expect(problems, "the browser console should stay clean").toEqual([]);
  },
});

export { expect };

export const today = () => utcDay(new Date());

const LABELS = ["Blue crystal", "Green crystal", "Red crystal", "Orange crystal"] as const;

export const crystal = (page: Page, index: CrystalIndex) =>
  page.getByRole("button", { name: new RegExp(`^${LABELS[index]},`) });

export async function clickAll(page: Page, moves: readonly CrystalIndex[]) {
  for (const move of moves) await crystal(page, move).click();
}

/** The first-run help dialog is covered by its own test; skip it everywhere else. */
export async function skipHelp(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("cc:v1:flag:seen-help", "true"));
}

export function winningMoves(puzzle: Puzzle): CrystalIndex[] {
  const solution = solve(puzzle.values, puzzle.target);
  if (!solution) throw new Error("every generated board should be winnable");
  return routeOf(solution);
}

/**
 * A click sequence that ends in a bust without ever landing exactly on the target.
 * Under "end" the round is lost; under "reset" the score returns to zero.
 * It always exists: four different crystal values cannot all hit the target at once.
 */
export function bustRoute(puzzle: Puzzle, policy: BustPolicy): CrystalIndex[] {
  const biggestFirst = [...CRYSTAL_INDEXES].sort((a, b) => puzzle.values[b] - puzzle.values[a]);
  let round = startRound(puzzle, policy);
  const moves: CrystalIndex[] = [];
  while (round.status === "playing" && round.busts === 0) {
    const next = biggestFirst.find((c) => round.score + puzzle.values[c] !== puzzle.target);
    if (next === undefined) throw new Error("distinct values cannot all hit the target");
    round = applyMove(round, next);
    moves.push(next);
  }
  return moves;
}

/** Lets CSS animations and transitions finish so screenshots and contrast checks see final colours. */
export async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
}

/** Resolves once React has rendered the board, so keyboard shortcuts are already listening. */
export async function boardReady(page: Page) {
  await expect(page.getByTestId("target")).toBeVisible();
}
