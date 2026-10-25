declare namespace Cloudflare {
  interface Env {
    // Injected by vitest.config.ts so the setup file can create the schema.
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
