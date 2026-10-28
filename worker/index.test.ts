import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyMove,
  CRYSTAL_INDEXES,
  type CrystalIndex,
  dailyPuzzle,
  MAX_MOVES,
  replayWin,
  routeOf,
  solve,
  startRound,
  trace,
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

/**
 * Builds a route that busts exactly once and never wins, on any board.
 *
 * The previous helper clicked the biggest crystal floor(target / biggest) + 1
 * times and assumed the last click overshot. When the biggest value divided
 * the target exactly, those clicks landed on the target and won instead, so
 * every later move was rejected as a move after the end. This version plays
 * the round with the engine itself: prefer the biggest crystal, but never
 * take a click that would win; the first click that overshoots is the single
 * bust, and the route ends there, mid-round.
 */
function bustRoute(day: string): CrystalIndex[] {
  const puzzle = dailyPuzzle(day);
  let round = startRound(puzzle, "reset");
  const route: CrystalIndex[] = [];

  while (round.busts === 0) {
    const remaining = puzzle.target - round.score;
    // Daily boards always deal four distinct values, so at most one crystal
    // can be worth exactly the remaining gap; any other click keeps playing
    // or busts, but can never win the round by accident.
    const move = [...CRYSTAL_INDEXES]
      .sort((left, right) => puzzle.values[right] - puzzle.values[left])
      .find((crystal) => puzzle.values[crystal] !== remaining);
    if (move === undefined) {
      throw new Error(`board for ${day} should always allow a non-winning click`);
    }
    route.push(move);
    round = applyMove(round, move);
  }

  if (round.status !== "playing" || round.busts !== 1) {
    throw new Error(`bust route for ${day} should end mid-round with exactly one bust`);
  }
  return route;
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

describe("bustRoute (regression: biggest crystal dividing the target)", () => {
  it("busts exactly once and stays winnable for every day in 2026", () => {
    // 2026-10-26 (target 27, biggest crystal 9) and 2026-10-29 (target 40,
    // biggest 10) are the days that exposed the old helper: 27 = 3 x 9 and
    // 40 = 4 x 10, so its "bust" clicks won the round instead of busting.
    // Sweep the whole year so the next divisible board is caught anywhere.
    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const day = utcDay(new Date(Date.UTC(2026, 0, 1 + dayOffset)));
      const puzzle = dailyPuzzle(day);
      const route = bustRoute(day);
      const steps = trace(puzzle, route, "reset");
      expect(
        steps.filter((step) => step.bust),
        day,
      ).toHaveLength(1);
      expect(steps.at(-1)?.bust, day).toBe(true);

      const replay = replayWin(puzzle, [...route, ...optimalRoute(day)], "reset");
      if (!replay.ok) {
        throw new Error(`${day}: bust route should leave a winnable board, got ${replay.reason}`);
      }
      expect(replay.round.busts, day).toBe(1);
    }
  });
});

describe("unknown API routes", () => {
  it("return JSON 404s", async () => {
    const response = await exports.default.fetch(`${ORIGIN}/api/nope`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
