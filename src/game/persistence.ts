import { type CrystalIndex, isCrystalIndex, MAX_MOVES } from "../../shared/engine";

/** The slice of the Web Storage API this app needs, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ClassicTotals {
  readonly wins: number;
  readonly losses: number;
  readonly streak: number;
  readonly bestStreak: number;
}

export interface DailyTotals {
  readonly played: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly lastWonDay: string | null;
}

export const EMPTY_CLASSIC_TOTALS: ClassicTotals = { wins: 0, losses: 0, streak: 0, bestStreak: 0 };
export const EMPTY_DAILY_TOTALS: DailyTotals = {
  played: 0,
  streak: 0,
  bestStreak: 0,
  lastWonDay: null,
};

const PREFIX = "cc:v1:";
const keys = {
  classic: `${PREFIX}classic`,
  dailyTotals: `${PREFIX}daily-totals`,
  daily: (day: string) => `${PREFIX}daily:${day}`,
  player: `${PREFIX}player`,
  flag: (name: string) => `${PREFIX}flag:${name}`,
};

/** localStorage can throw (private windows, blocked cookies), so a missing store is normal. */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(store: KeyValueStore | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function write(store: KeyValueStore | null, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game keeps working, it just will not remember.
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const count = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function loadClassicTotals(store: KeyValueStore | null = browserStore()): ClassicTotals {
  const raw = read(store, keys.classic);
  if (!isRecord(raw)) return EMPTY_CLASSIC_TOTALS;
  return {
    wins: count(raw.wins),
    losses: count(raw.losses),
    streak: count(raw.streak),
    bestStreak: count(raw.bestStreak),
  };
}

export function saveClassicTotals(
  totals: ClassicTotals,
  store: KeyValueStore | null = browserStore(),
): void {
  write(store, keys.classic, totals);
}

export function loadDailyTotals(store: KeyValueStore | null = browserStore()): DailyTotals {
  const raw = read(store, keys.dailyTotals);
  if (!isRecord(raw)) return EMPTY_DAILY_TOTALS;
  return {
    played: count(raw.played),
    streak: count(raw.streak),
    bestStreak: count(raw.bestStreak),
    lastWonDay: typeof raw.lastWonDay === "string" ? raw.lastWonDay : null,
  };
}

export function saveDailyTotals(
  totals: DailyTotals,
  store: KeyValueStore | null = browserStore(),
): void {
  write(store, keys.dailyTotals, totals);
}

/** The clicks made so far on a day's puzzle; replaying them restores the round exactly. */
export function loadDailyMoves(
  day: string,
  store: KeyValueStore | null = browserStore(),
): CrystalIndex[] {
  const raw = read(store, keys.daily(day));
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_MOVES).filter(isCrystalIndex);
}

export function saveDailyMoves(
  day: string,
  moves: readonly CrystalIndex[],
  store: KeyValueStore | null = browserStore(),
): void {
  write(store, keys.daily(day), moves);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Anonymous, random, and only used to keep one leaderboard row per player per day. */
export function loadPlayerId(store: KeyValueStore | null = browserStore()): string {
  const saved = read(store, keys.player);
  if (typeof saved === "string" && UUID.test(saved)) return saved;
  const created = crypto.randomUUID();
  write(store, keys.player, created);
  return created;
}

export function loadFlag(name: string, store: KeyValueStore | null = browserStore()): boolean {
  return read(store, keys.flag(name)) === true;
}

export function saveFlag(
  name: string,
  value: boolean,
  store: KeyValueStore | null = browserStore(),
): void {
  write(store, keys.flag(name), value);
}
