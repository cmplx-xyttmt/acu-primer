import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so tests of the pure logic don't start the Worker runtime.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
});
