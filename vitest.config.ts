import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["shared/**/*.test.ts", "src/**/*.test.ts"],
        },
      },
      {
        plugins: [
          cloudflareTest(async () => {
            const migrations = await readD1Migrations("./migrations");
            return {
              wrangler: { configPath: "./wrangler.jsonc" },
              // Test-only binding so the setup file can create the schema.
              miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
            };
          }),
        ],
        test: {
          name: "worker",
          include: ["worker/**/*.test.ts"],
          setupFiles: ["./worker/test/apply-migrations.ts"],
        },
      },
    ],
  },
});
