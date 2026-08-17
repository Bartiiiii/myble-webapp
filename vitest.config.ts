import { defineConfig } from "vitest/config";

// Pure-logic unit tests (pricing, quote, geometry) run in node. The checkout
// interstitial is the one piece of UI worth asserting in vitest — it decides
// whether a customer is told a payment happens — so `app/**/*.test.tsx` runs in
// jsdom via a per-file docblock. Everything else in the 3D + UI layer is still
// verified in the browser.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.tsx"],
  },
});
