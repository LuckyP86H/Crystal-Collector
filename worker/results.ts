import type { DailyStats, HistogramBucket, RunResult } from "../shared/api";

interface SavedRow {
  clicks: number;
  busts: number;
}

/**
 * Keeps a player's best run: inserts a first result, replaces it only when the
 * new run used fewer clicks. `meta.changes` is 1 for an insert or improvement
 * and 0 when the stored result was already at least as good.
 */
const UPSERT_BEST = `
  INSERT INTO daily_results (day, player_id, clicks, busts)
  VALUES (?1, ?2, ?3, ?4)
  ON CONFLICT (day, player_id) DO UPDATE
    SET clicks = excluded.clicks, busts = excluded.busts
    WHERE excluded.clicks < daily_results.clicks`;

const SELECT_MINE = "SELECT clicks, busts FROM daily_results WHERE day = ?1 AND player_id = ?2";

const SELECT_HISTOGRAM = `
  SELECT clicks, COUNT(*) AS players
  FROM daily_results
  WHERE day = ?1
  GROUP BY clicks
  ORDER BY clicks`;

function summarise(
  day: string,
  histogram: readonly HistogramBucket[],
  mine: SavedRow | null,
): DailyStats {
  const players = histogram.reduce((total, bucket) => total + bucket.players, 0);
  if (!mine) return { day, players, histogram, you: null };

  const fewer = histogram
    .filter((bucket) => bucket.clicks < mine.clicks)
    .reduce((total, bucket) => total + bucket.players, 0);
  return { day, players, histogram, you: { ...mine, rank: fewer + 1 } };
}

export async function readStats(
  db: D1Database,
  day: string,
  playerId: string | null,
): Promise<DailyStats> {
  const [mine, histogram] = await db.batch<SavedRow | HistogramBucket>([
    db.prepare(SELECT_MINE).bind(day, playerId ?? ""),
    db.prepare(SELECT_HISTOGRAM).bind(day),
  ]);
  return summarise(
    day,
    (histogram?.results ?? []) as HistogramBucket[],
    (mine?.results[0] as SavedRow | undefined) ?? null,
  );
}

export async function saveResult(
  db: D1Database,
  day: string,
  playerId: string,
  run: RunResult,
): Promise<{ improved: boolean; stats: DailyStats }> {
  // One batch = one transaction, so the stats always include the row just written.
  const [save, mine, histogram] = await db.batch<SavedRow | HistogramBucket>([
    db.prepare(UPSERT_BEST).bind(day, playerId, run.clicks, run.busts),
    db.prepare(SELECT_MINE).bind(day, playerId),
    db.prepare(SELECT_HISTOGRAM).bind(day),
  ]);
  return {
    improved: (save?.meta.changes ?? 0) > 0,
    stats: summarise(
      day,
      (histogram?.results ?? []) as HistogramBucket[],
      (mine?.results[0] as SavedRow | undefined) ?? null,
    ),
  };
}
