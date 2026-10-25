import type { DailyStats } from "../../shared/api";
import { pluralise } from "../lib/share";

export function Histogram({ stats }: { readonly stats: DailyStats }) {
  const most = Math.max(1, ...stats.histogram.map((bucket) => bucket.players));

  return (
    <table className="w-full border-separate border-spacing-y-1 text-sm">
      <caption className="sr-only">Players by number of clicks</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Clicks</th>
          <th scope="col">Share of players</th>
          <th scope="col">Players</th>
        </tr>
      </thead>
      <tbody>
        {stats.histogram.map((bucket) => {
          const mine = stats.you?.clicks === bucket.clicks;
          return (
            <tr key={bucket.clicks} aria-current={mine ? "true" : undefined}>
              <th scope="row" className="w-10 pr-2 text-right font-medium tabular-nums">
                {bucket.clicks}
              </th>
              <td className="w-full">
                <div
                  className={`h-4 min-w-1.5 rounded-full ${mine ? "bg-good" : "bg-accent/60"}`}
                  style={{ width: `${(bucket.players / most) * 100}%` }}
                  title={`${pluralise(bucket.players, "player")} used ${pluralise(bucket.clicks, "click")}`}
                />
              </td>
              <td className="w-8 pl-2 text-right tabular-nums text-muted">{bucket.players}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
