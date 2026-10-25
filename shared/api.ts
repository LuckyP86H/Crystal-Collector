/** Shapes returned by the leaderboard API, shared by the Worker and the browser. */

export interface RunResult {
  readonly clicks: number;
  readonly busts: number;
}

export interface HistogramBucket {
  readonly clicks: number;
  readonly players: number;
}

export interface DailyStats {
  readonly day: string;
  readonly players: number;
  readonly histogram: readonly HistogramBucket[];
  /** The asking player's best result and rank (1 = fewest clicks), if they have played. */
  readonly you: (RunResult & { readonly rank: number }) | null;
}

export interface SubmitResponse extends DailyStats {
  /** True when this run was stored: a first result, or fewer clicks than before. */
  readonly improved: boolean;
}
