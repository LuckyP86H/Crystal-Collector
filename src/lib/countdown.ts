const MS_PER_DAY = 86_400_000;

/** Milliseconds until the next 00:00 UTC, when a new daily puzzle starts. */
export function msUntilNextPuzzle(now: Date): number {
  return MS_PER_DAY - (now.getTime() % MS_PER_DAY);
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(totalSeconds % 60)}`;
}
