import type { DailyStats, SubmitResponse } from "../../shared/api";

const TIMEOUT_MS = 8_000;

function isStats(value: unknown): value is DailyStats {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DailyStats>;
  return (
    typeof candidate.day === "string" &&
    typeof candidate.players === "number" &&
    Array.isArray(candidate.histogram)
  );
}

async function request(url: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(url, {
    ...init,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Leaderboard calls are a bonus: any failure (offline, 5xx, bad JSON) simply yields null. */
export async function submitRun(
  day: string,
  playerId: string,
  moves: readonly number[],
  signal?: AbortSignal,
): Promise<SubmitResponse | null> {
  try {
    const body = await request(
      `/api/daily/${day}/results`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, moves }),
      },
      signal,
    );
    return isStats(body) ? (body as SubmitResponse) : null;
  } catch {
    return null;
  }
}
