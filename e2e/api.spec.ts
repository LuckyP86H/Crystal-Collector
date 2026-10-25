import { dailyPuzzle } from "../shared/engine";
import { expect, test, today, winningMoves } from "./support";

// These run against the production build in workerd, without the Node.js
// compatibility flags that the Vitest Workers pool injects, so they prove the
// deployed Worker has no hidden Node-only dependency.

test("serves security headers with the page", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("reports health", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

test("verifies runs on the server", async ({ request }) => {
  const day = today();
  const playerId = crypto.randomUUID();
  const moves = winningMoves(dailyPuzzle(day));

  const accepted = await request.post(`/api/daily/${day}/results`, { data: { playerId, moves } });
  expect([200, 201]).toContain(accepted.status());
  const body = await accepted.json();
  expect(body.you).toMatchObject({ clicks: moves.length, busts: 0 });
  expect(body.players).toBeGreaterThanOrEqual(1);

  const forged = await request.post(`/api/daily/${day}/results`, {
    data: { playerId: crypto.randomUUID(), moves: moves.slice(0, -1) },
  });
  expect(forged.status()).toBe(422);
  expect(await forged.json()).toEqual({ error: "invalid_run", reason: "unfinished" });

  const stats = await request.get(`/api/daily/${day}/stats?player=${playerId}`);
  expect(stats.status()).toBe(200);
  expect((await stats.json()).you.clicks).toBe(moves.length);
});

test("answers unknown API routes with JSON, not the app shell", async ({ request }) => {
  const response = await request.get("/api/unknown");
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/json");
});

test("falls back to the app for deep links", async ({ request }) => {
  const response = await request.get("/some/deep/link");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/html");
});
