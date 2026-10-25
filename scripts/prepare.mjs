// Runs after `pnpm install`. On Cloudflare Workers Builds (which sets WORKERS_CI=1) it builds the
// app, so the default `wrangler deploy` works even if the dashboard's build command is empty.
// Everywhere else it does nothing.
import { spawnSync } from "node:child_process";

if (process.env.WORKERS_CI === "1") {
  const result = spawnSync("pnpm", ["exec", "vite", "build"], { stdio: "inherit", shell: true });
  process.exit(result.status ?? 1);
}
