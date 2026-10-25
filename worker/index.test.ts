import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CRYSTAL_INDEXES,
  type CrystalIndex,
  dailyPuzzle,
  MAX_MOVES,
  routeOf,
  solve,
  utcDay,
} from "../shared/engine";

const ORIGIN = "https://crystal.test";

// Storage is isolated per test file, not per test, so start every test from an empty table.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM daily_results").run();
});
const today = utcDay(new Date());
const daysAgo = (days: number) => utcDay(new Date(Date.now() - days * 86_400_000));

/** A bust-free winning route for the day's board, built from the solver. */
function optimalRoute(day: string): CrystalIndex[] {
  const { values, target } = dailyPuzzle(day);
  const solution = solve(values, target);
  if (!solution) throw new Error(`board for ${day} should always be winnable`);
  return routeOf(solution);
}

/** Clicks the biggest crystal until the score overshoots, forcing exactly one bust. */
function bustRoute(day: string): CrystalIndex[] {
  const { values, target } = dailyPuzzle(day);
  const biggest = CRYSTAL_INDEXES.reduce((best, crystal) =>
    values[crystal] > values[best] ? crystal : best,
  );
  return Array.from({ length: Math.floor(target / values[biggest]) + 1 }, () => biggest);
}

function post(day: string, body: unknown, init: RequestInit = {}) {
  return exports.default.fetch(`${ORIGIN}/api/daily/${day}/results`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

function stats(day: string, playerId?: string) {
  const query = playerId ? `?player=${playerId}` : "";
  return exports.default.fetch(`${ORIGIN}/api/daily/${day}/stats${query}`);
}

describe("GET /api/health", () => {
  it("reports ok and sets security headers", async () => {
    const response = await exports.default.fetch(`${ORIGIN}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("GET /api/daily/:day/stats", () => {
  it("returns an empty board for a day nobody has played", async () => {
    const response = await stats(today);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=30");
    expect(await response.json()).toEqual({ day: today, players: 0, histogram: [], you: null });
  });

  it("rejects malformed days and player ids", async () => {
    expect((await stats("2026-02-30")).status).toBe(400);
    expect((await stats("yesterday")).status).toBe(400);
    expect((await stats(today, "not-a-uuid")).status).toBe(400);
  });
});

describe("POST /api/daily/:day/results", () => {
  it("accepts a verified win and ranks the player first", async () => {
    const playerId = crypto.randomUUID();
    const route = optimalRoute(today);

    const response = await post(today, { playerId, moves: route });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      improved: true,
      day: today,
      players: 1,
      histogram: [{ clicks: route.length, players: 1 }],
      you: { clicks: route.length, busts: 0, rank: 1 },
    });
  });

  it("keeps a player's best run and ignores a worse one", async () => {
    const playerId = crypto.randomUUID();
    const route = optimalRoute(today);
    await post(today, { playerId, moves: route });

    const worse = await post(today, { playerId, moves: [...bustRoute(today), ...route] });
    expect(worse.status).toBe(200);
    const body = (await worse.json()) as { improved: boolean; you: { clicks: number } };
    expect(body.improved).toBe(false);
    expect(body.you.clicks).toBe(route.length);
  });

  it("replaces an earlier result when the new run is better", async () => {
    const playerId = crypto.randomUUID();
    const route = optimalRoute(today);
    const slow = [...bustRoute(today), ...route];
    expect((await post(today, { playerId, moves: slow })).status).toBe(201);

    const better = await post(today, { playerId, moves: route });
    expect(better.status).toBe(201);
    const body = (await better.json()) as {
      players: number;
      histogram: { clicks: number; players: number }[];
      you: { clicks: number; busts: number };
    };
    expect(body.players).toBe(1);
    expect(body.histogram).toEqual([{ clicks: route.length, players: 1 }]);
    expect(body.you).toMatchObject({ clicks: route.length, busts: 0 });
  });

  it("ranks players by clicks and lets ties share a rank", async () => {
    const route = optimalRoute(today);
    const bust = bustRoute(today);
    const [first, second, third, fourth] = Array.from({ length: 4 }, () => crypto.randomUUID());
    await post(today, { playerId: first, moves: route });
    await post(today, { playerId: second, moves: [...bust, ...route] });
    await post(today, { playerId: third, moves: [...bust, ...bust, ...route] });
    await post(today, { playerId: fourth, moves: [...bust, ...route] });

    const ranks = await Promise.all(
      [first, second, third, fourth].map(async (id) => {
        const body = (await (await stats(today, id)).json()) as { you: { rank: number } };
        return body.you.rank;
      }),
    );
    expect(ranks).toEqual([1, 2, 4, 2]);
  });

  it("keeps different days separate", async () => {
    const playerId = crypto.randomUUID();
    await post(today, { playerId, moves: optimalRoute(today) });
    const yesterday = daysAgo(1);
    expect(await (await stats(yesterday)).json()).toMatchObject({ players: 0 });
  });

  it("counts every player when many submit at once", async () => {
    const route = optimalRoute(today);
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        post(today, { playerId: crypto.randomUUID(), moves: route }),
      ),
    );
    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(await (await stats(today)).json()).toMatchObject({ players: 12 });
  });

  it("rejects runs that do not win, with the reason", async () => {
    const playerId = crypto.randomUUID();
    const route = optimalRoute(today);

    const unfinished = await post(today, { playerId, moves: route.slice(0, -1) });
    expect(unfinished.status).toBe(422);
    expect(await unfinished.json()).toEqual({ error: "invalid_run", reason: "unfinished" });

    const afterWin = await post(today, { playerId, moves: [...route, 0] });
    expect(await afterWin.json()).toEqual({ error: "invalid_run", reason: "moves-after-end" });

    const badMove = await post(today, { playerId, moves: [...route, 7] });
    expect(await badMove.json()).toEqual({ error: "invalid_run", reason: "invalid-move" });
  });

  it("never stores a rejected run", async () => {
    await post(today, { playerId: crypto.randomUUID(), moves: [0, 0, 0] });
    expect(await (await stats(today)).json()).toMatchObject({ players: 0 });
  });

  it("rejects runs longer than the cap", async () => {
    const response = await post(today, {
      playerId: crypto.randomUUID(),
      moves: Array.from({ length: MAX_MOVES + 1 }, () => 0),
    });
    expect(response.status).toBe(400);
  });

  it("rejects bad bodies", async () => {
    const playerId = crypto.randomUUID();
    const moves = optimalRoute(today);
    for (const body of [
      {},
      { playerId, moves: [] },
      { playerId: "nope", moves },
      { playerId, moves, extra: true },
      { playerId, moves: "0,1" },
    ]) {
      const response = await post(today, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_body" });
    }
    const notJson = await post(today, undefined, { body: "{oops" });
    expect(notJson.status).toBe(400);
  });

  it("rejects the wrong content type and oversized payloads", async () => {
    const playerId = crypto.randomUUID();
    const wrongType = await post(today, { playerId, moves: [0] }, { headers: {} });
    expect(wrongType.status).toBe(415);

    const huge = await post(today, { playerId, moves: [0], padding: "x".repeat(8 * 1024) });
    expect(huge.status).toBe(413);
  });

  it("rejects days that are malformed or too far from today", async () => {
    const body = { playerId: crypto.randomUUID(), moves: [0] };
    expect((await post("2026-02-30", body)).status).toBe(400);
    const stale = await post(daysAgo(5), body);
    expect(stale.status).toBe(422);
    expect(await stale.json()).toEqual({ error: "day_out_of_range" });
    expect((await post(utcDay(new Date(Date.now() + 5 * 86_400_000)), body)).status).toBe(422);
  });

  it("answers other methods with 405", async () => {
    const response = await exports.default.fetch(`${ORIGIN}/api/daily/${today}/results`);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});

describe("unknown API routes", () => {
  it("return JSON 404s", async () => {
    const response = await exports.default.fetch(`${ORIGIN}/api/nope`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
