/**
 * Crystal Collector rules.
 *
 * Pure TypeScript with no DOM or Workers APIs, so the browser plays rounds with
 * it and the Worker re-plays submitted runs with the very same code.
 */

export const TARGET_MIN = 19;
export const TARGET_MAX = 120;
export const VALUE_MIN = 1;
export const VALUE_MAX = 12;
/** Longest winning route a generated board may need, so every board stays playable. */
export const MAX_MIN_CLICKS = 12;
/** Most clicks a single replay may contain; guards the server against junk input. */
export const MAX_MOVES = 300;

export type CrystalIndex = 0 | 1 | 2 | 3;
export type CrystalValues = readonly [number, number, number, number];
export type Counts = readonly [number, number, number, number];

export const CRYSTAL_INDEXES: readonly CrystalIndex[] = [0, 1, 2, 3];

export interface Puzzle {
  readonly target: number;
  readonly values: CrystalValues;
  /** Fewest clicks that reach `target` if every crystal value were already known. */
  readonly minClicks: number;
}

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

export type Rng = () => number;

/** mulberry32: small, fast, and bit-for-bit identical on every JavaScript engine. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a followed by a murmur3 finaliser, so near-identical strings give unrelated seeds. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** Uniform integer in [min, max], both ends included. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Solver: unbounded coin change
// ---------------------------------------------------------------------------

export interface Solution {
  readonly clicks: number;
  /** How many times to click each crystal. */
  readonly counts: Counts;
}

/**
 * Fewest clicks that sum to `target`, found with the classic coin-change DP
 * (each crystal is a coin that may be used any number of times).
 * Returns null when the target cannot be reached at all.
 */
export function solve(values: CrystalValues, target: number): Solution | null {
  const unreachable = Number.POSITIVE_INFINITY;
  const fewest = new Array<number>(target + 1).fill(unreachable);
  const lastCrystal = new Array<CrystalIndex | undefined>(target + 1).fill(undefined);
  fewest[0] = 0;

  for (let sum = 1; sum <= target; sum++) {
    for (const crystal of CRYSTAL_INDEXES) {
      const viaThisCrystal = (fewest[sum - values[crystal]] ?? unreachable) + 1;
      if (viaThisCrystal < (fewest[sum] ?? unreachable)) {
        fewest[sum] = viaThisCrystal;
        lastCrystal[sum] = crystal;
      }
    }
  }

  const clicks = fewest[target] ?? unreachable;
  if (!Number.isFinite(clicks)) return null;

  const counts: [number, number, number, number] = [0, 0, 0, 0];
  for (let sum = target; sum > 0; ) {
    const crystal = lastCrystal[sum];
    if (crystal === undefined) return null;
    counts[crystal] += 1;
    sum -= values[crystal];
  }
  return { clicks, counts };
}

/** Expands a solution into a concrete click order, grouped by crystal. */
export function routeOf(solution: Solution): CrystalIndex[] {
  return CRYSTAL_INDEXES.flatMap((crystal) =>
    Array.from({ length: solution.counts[crystal] }, () => crystal),
  );
}

// ---------------------------------------------------------------------------
// Puzzle generation
// ---------------------------------------------------------------------------

function drawDistinctValue(rng: Rng, taken: readonly number[]): number {
  let value = randomInt(rng, VALUE_MIN, VALUE_MAX);
  while (taken.includes(value)) value = randomInt(rng, VALUE_MIN, VALUE_MAX);
  return value;
}

/**
 * Draws boards until one is winnable and not tediously long. The original game
 * could deal boards with no winning route at all (for example target 19 with
 * four 12s); rejecting them here removes that whole class of unfair round.
 */
export function generatePuzzle(rng: Rng): Puzzle {
  for (;;) {
    const target = randomInt(rng, TARGET_MIN, TARGET_MAX);
    const a = drawDistinctValue(rng, []);
    const b = drawDistinctValue(rng, [a]);
    const c = drawDistinctValue(rng, [a, b]);
    const d = drawDistinctValue(rng, [a, b, c]);
    const values: CrystalValues = [a, b, c, d];
    const solution = solve(values, target);
    if (solution && solution.clicks <= MAX_MIN_CLICKS) {
      return { target, values, minClicks: solution.clicks };
    }
  }
}

export function puzzleFromSeed(seed: string): Puzzle {
  return generatePuzzle(createRng(hashSeed(seed)));
}

/** Classic boards are named by a short id; the same id always deals the same board. */
export function classicPuzzle(boardId: string): Puzzle {
  return puzzleFromSeed(`crystal-collector/classic/${boardId}`);
}

// ---------------------------------------------------------------------------
// Daily puzzle calendar (always UTC, so everyone shares the same board)
// ---------------------------------------------------------------------------

/** Puzzle #1. Only used to number the daily puzzles. */
export const DAILY_EPOCH = "2026-10-25";

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isValidDay(day: string): boolean {
  const match = DAY_PATTERN.exec(day);
  if (!match) return false;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === date
  );
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The calendar day `delta` days after (or before, if negative) a valid day. */
export function shiftDay(day: string, delta: number): string {
  return utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + delta * MS_PER_DAY));
}

/** 1 for the epoch day, 2 for the day after, and so on. Expects a valid day. */
export function dayNumber(day: string): number {
  const elapsed = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`);
  return Math.round(elapsed / MS_PER_DAY) + 1;
}

export function dailyPuzzle(day: string): Puzzle {
  return puzzleFromSeed(`crystal-collector/daily/${day}`);
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

/**
 * What a bust (score above the target) does:
 * - "end": the round is lost (Classic).
 * - "reset": the score returns to zero and play continues on the same board (Daily).
 */
export type BustPolicy = "end" | "reset";
export type RoundStatus = "playing" | "won" | "lost";

export interface Round {
  readonly puzzle: Puzzle;
  readonly policy: BustPolicy;
  readonly score: number;
  readonly status: RoundStatus;
  readonly moves: readonly CrystalIndex[];
  readonly busts: number;
  /** Crystals clicked at least once, i.e. whose value the player has now seen. */
  readonly revealed: readonly boolean[];
}

export function startRound(puzzle: Puzzle, policy: BustPolicy): Round {
  return {
    puzzle,
    policy,
    score: 0,
    status: "playing",
    moves: [],
    busts: 0,
    revealed: [false, false, false, false],
  };
}

export function applyMove(round: Round, move: CrystalIndex): Round {
  if (round.status !== "playing") return round;

  const { target, values } = round.puzzle;
  const score = round.score + values[move];
  const moves = [...round.moves, move];
  const revealed = round.revealed.map((seen, index) => seen || index === move);

  if (score === target) return { ...round, score, moves, revealed, status: "won" };
  if (score < target) return { ...round, score, moves, revealed };
  if (round.policy === "end") return { ...round, score, moves, revealed, status: "lost" };
  return { ...round, score: 0, moves, revealed, busts: round.busts + 1 };
}

export interface Step {
  readonly move: CrystalIndex;
  readonly bust: boolean;
}

/** Per-click view of a run, used to draw the share grid. */
export function trace(puzzle: Puzzle, moves: readonly CrystalIndex[], policy: BustPolicy): Step[] {
  let round = startRound(puzzle, policy);
  return moves.map((move) => {
    const bustsBefore = round.busts;
    round = applyMove(round, move);
    return { move, bust: round.busts > bustsBefore || round.status === "lost" };
  });
}

// ---------------------------------------------------------------------------
// Replay (server-side verification)
// ---------------------------------------------------------------------------

export type ReplayFailure = "too-many-moves" | "invalid-move" | "moves-after-end" | "unfinished";

export type ReplayResult =
  | { readonly ok: true; readonly round: Round }
  | { readonly ok: false; readonly reason: ReplayFailure };

export function isCrystalIndex(value: unknown): value is CrystalIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** Re-plays a run from scratch and succeeds only if it ends in a win. */
export function replayWin(
  puzzle: Puzzle,
  moves: readonly unknown[],
  policy: BustPolicy = "reset",
): ReplayResult {
  if (moves.length > MAX_MOVES) return { ok: false, reason: "too-many-moves" };

  let round = startRound(puzzle, policy);
  for (const move of moves) {
    if (!isCrystalIndex(move)) return { ok: false, reason: "invalid-move" };
    if (round.status !== "playing") return { ok: false, reason: "moves-after-end" };
    round = applyMove(round, move);
  }
  return round.status === "won" ? { ok: true, round } : { ok: false, reason: "unfinished" };
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

export type Rating = "crystal-clear" | "sharp" | "solved";

/**
 * Grades a win by how many clicks it took beyond the theoretical minimum.
 * Reaching the minimum exactly is rare because values are hidden and must be
 * discovered by clicking, so the bands are deliberately generous.
 */
export function rate(clicks: number, minClicks: number): Rating {
  const extra = clicks - minClicks;
  if (extra <= 2) return "crystal-clear";
  if (extra <= 5) return "sharp";
  return "solved";
}
