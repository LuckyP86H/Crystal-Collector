import { describe, expect, it } from "vitest";
import { MAX_MOVES } from "../../shared/engine";
import {
  EMPTY_CLASSIC_TOTALS,
  EMPTY_DAILY_TOTALS,
  type KeyValueStore,
  loadClassicTotals,
  loadDailyMoves,
  loadDailyTotals,
  loadFlag,
  loadPlayerId,
  saveClassicTotals,
  saveDailyMoves,
  saveDailyTotals,
  saveFlag,
} from "./persistence";

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const throwingStore: KeyValueStore = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("quota exceeded");
  },
};

describe("persistence", () => {
  it("starts from empty totals", () => {
    const store = new MemoryStore();
    expect(loadClassicTotals(store)).toEqual(EMPTY_CLASSIC_TOTALS);
    expect(loadDailyTotals(store)).toEqual(EMPTY_DAILY_TOTALS);
    expect(loadDailyMoves("2026-10-25", store)).toEqual([]);
  });

  it("round-trips everything it saves", () => {
    const store = new MemoryStore();
    const classic = { wins: 3, losses: 2, streak: 1, bestStreak: 3 };
    const daily = { played: 4, streak: 2, bestStreak: 3, lastWonDay: "2026-10-25" };
    saveClassicTotals(classic, store);
    saveDailyTotals(daily, store);
    saveDailyMoves("2026-10-25", [0, 3, 2], store);
    saveFlag("muted", true, store);
    expect(loadClassicTotals(store)).toEqual(classic);
    expect(loadDailyTotals(store)).toEqual(daily);
    expect(loadDailyMoves("2026-10-25", store)).toEqual([0, 3, 2]);
    expect(loadDailyMoves("2026-10-26", store)).toEqual([]);
    expect(loadFlag("muted", store)).toBe(true);
    expect(loadFlag("seen-help", store)).toBe(false);
  });

  it("ignores corrupt or tampered data instead of crashing", () => {
    const store = new MemoryStore();
    store.data.set("cc:v1:classic", "{not json");
    store.data.set(
      "cc:v1:daily-totals",
      JSON.stringify({ played: -4, streak: "x", lastWonDay: 7 }),
    );
    store.data.set("cc:v1:daily:2026-10-25", JSON.stringify({ not: "an array" }));
    expect(loadClassicTotals(store)).toEqual(EMPTY_CLASSIC_TOTALS);
    expect(loadDailyTotals(store)).toEqual(EMPTY_DAILY_TOTALS);
    expect(loadDailyMoves("2026-10-25", store)).toEqual([]);
  });

  it("drops invalid clicks and caps the saved run length", () => {
    const store = new MemoryStore();
    store.data.set("cc:v1:daily:2026-10-25", JSON.stringify([0, 9, "1", null, 2, 1.5, 3]));
    expect(loadDailyMoves("2026-10-25", store)).toEqual([0, 2, 3]);

    store.data.set("cc:v1:daily:2026-10-26", JSON.stringify(Array.from({ length: 1000 }, () => 1)));
    expect(loadDailyMoves("2026-10-26", store)).toHaveLength(MAX_MOVES);
  });

  it("creates one stable anonymous player id and replaces a bad one", () => {
    const store = new MemoryStore();
    const first = loadPlayerId(store);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(loadPlayerId(store)).toBe(first);

    store.data.set("cc:v1:player", JSON.stringify("not-a-uuid"));
    expect(loadPlayerId(store)).not.toBe("not-a-uuid");
  });

  it("keeps working when storage is unavailable or throws", () => {
    for (const store of [null, throwingStore]) {
      expect(loadClassicTotals(store)).toEqual(EMPTY_CLASSIC_TOTALS);
      expect(loadDailyMoves("2026-10-25", store)).toEqual([]);
      expect(loadFlag("muted", store)).toBe(false);
      expect(() => saveClassicTotals(EMPTY_CLASSIC_TOTALS, store)).not.toThrow();
      expect(() => saveDailyMoves("2026-10-25", [1], store)).not.toThrow();
      expect(loadPlayerId(store)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
