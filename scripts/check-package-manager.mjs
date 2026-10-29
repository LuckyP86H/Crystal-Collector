// Enforces the one-package-manager rule (see "Repository conventions" in the README).
// pnpm is pinned in package.json's "packageManager" field; installing with another
// manager would generate a competing lockfile and a node_modules layout pnpm did not
// intend, so refuse the install and say what to run instead. (Bun never runs a root
// preinstall script; its lockfile is blocked by .gitignore instead.)
const userAgent = process.env.npm_config_user_agent ?? "";
const manager = userAgent.split("/")[0];

if (manager !== "pnpm") {
  console.error(
    [
      'This repository uses pnpm, pinned in package.json ("packageManager").',
      `Detected installer: ${manager || "unknown"} — refusing to install.`,
      "Run: corepack enable && pnpm install",
    ].join("\n"),
  );
  process.exit(1);
}
