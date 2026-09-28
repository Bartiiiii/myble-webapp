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
    // The jsdom checkout tests mount a whole page and wait on findBy* queries.
    // Vitest's 5 s default is comfortable on an idle machine and not when the
    // suite shares a laptop with a build, where they were failing on timing
    // alone. The pure-logic tests finish in single-digit ms either way, so a
    // longer ceiling costs a slow suite nothing and buys a trustworthy one.
    testTimeout: 20_000,
  },
});
