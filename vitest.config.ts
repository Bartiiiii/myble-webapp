import { defineConfig } from "vitest/config";

// Pure-logic unit tests only (pricing, quote, geometry). No DOM/React here — the
// 3D + UI is verified in the browser preview, not in vitest.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
