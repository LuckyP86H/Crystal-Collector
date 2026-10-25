import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { dailyPuzzle, dayNumber, isValidDay, MAX_MOVES, replayWin, utcDay } from "../shared/engine";
import { readStats, saveResult } from "./results";

const MAX_BODY_BYTES = 4 * 1024;

/** Results are accepted for today and one day either side, to tolerate clock and time-zone skew. */
const ACCEPTED_DAY_DRIFT = 1;

const runSchema = z.strictObject({
  playerId: z.uuid(),
  moves: z.array(z.number()).min(1).max(MAX_MOVES),
});

const playerQuerySchema = z.uuid().nullable();

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", secureHeaders());

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/daily/:day/stats", async (c) => {
  const day = c.req.param("day");
  if (!isValidDay(day)) return c.json({ error: "invalid_day" }, 400);

  const player = playerQuerySchema.safeParse(c.req.query("player") ?? null);
  if (!player.success) return c.json({ error: "invalid_player" }, 400);

  const stats = await readStats(c.env.DB, day, player.data);
  c.header("Cache-Control", "public, max-age=30");
  return c.json(stats);
});

app.post(
  "/api/daily/:day/results",
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: "payload_too_large" }, 413),
  }),
  async (c) => {
    const day = c.req.param("day");
    if (!isValidDay(day)) return c.json({ error: "invalid_day" }, 400);
    if (Math.abs(dayNumber(day) - dayNumber(utcDay(new Date()))) > ACCEPTED_DAY_DRIFT) {
      return c.json({ error: "day_out_of_range" }, 422);
    }

    if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
      return c.json({ error: "unsupported_media_type" }, 415);
    }
    const body: unknown = await c.req.json().catch(() => undefined);
    const run = runSchema.safeParse(body);
    if (!run.success) return c.json({ error: "invalid_body" }, 400);

    // Never trust the client: replay the clicks on the day's board and require a win.
    const replay = replayWin(dailyPuzzle(day), run.data.moves, "reset");
    if (!replay.ok) return c.json({ error: "invalid_run", reason: replay.reason }, 422);

    const { improved, stats } = await saveResult(c.env.DB, day, run.data.playerId, {
      clicks: replay.round.moves.length,
      busts: replay.round.busts,
    });
    c.header("Cache-Control", "no-store");
    return c.json({ improved, ...stats }, improved ? 201 : 200);
  },
);

app.all("/api/daily/:day/results", (c) => {
  c.header("Allow", "POST");
  return c.json({ error: "method_not_allowed" }, 405);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((error, c) => {
  console.error("unhandled error", error);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
