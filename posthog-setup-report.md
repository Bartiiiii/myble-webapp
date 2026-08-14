# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Myble furniture configurator. The following changes were made:

- **`instrumentation-client.ts`** — Created: initializes `posthog-js` on the client side using the EU endpoint, with exception tracking and debug mode in development. Uses the Next.js 15.3+ `instrumentation-client` pattern (no provider needed).
- **`next.config.ts`** — Updated: added reverse proxy rewrites for `/ingest/*` to route through the EU PostHog ingestion endpoint, and set `skipTrailingSlashRedirect: true`.
- **`lib/posthog-server.ts`** — Created: singleton server-side `posthog-node` client for future server-side event capture.
- **`app/providers.tsx`** — Updated: added a `PostHogIdentify` component that calls `posthog.identify()` with the user's email and name whenever a NextAuth session is present, ensuring authenticated users are correlated across sessions.
- **`app/page.tsx`** — Updated: `home_cta_clicked` captured on the hero and teaser CTA buttons; `faq_item_opened` captured when a user expands a FAQ item.
- **`app/design/page.tsx`** — Updated: `preset_applied`, `part_added`, `colour_selected`, `thickness_selected`, and `order_initiated` (with full design spec and price) captured on the respective user interactions.
- **`app/order/page.tsx`** — Updated: `order_placed` (the primary conversion event, with full order details) and `cut_list_downloaded` (with format) captured.
- **`app/order/login/page.tsx`** — Updated: `order_login_initiated` and `order_login_skipped` captured.
- **`app/login/page.tsx`** — Updated: `login_initiated` captured.

## Events

| Event name | Description | File |
|---|---|---|
| `home_cta_clicked` | User clicks a primary CTA button on the home page to enter the configurator. | `app/page.tsx` |
| `faq_item_opened` | User expands a FAQ item on the home page. | `app/page.tsx` |
| `preset_applied` | User selects a furniture preset in the configurator. | `app/design/page.tsx` |
| `part_added` | User adds a shelf, divider, or wall in the configurator. | `app/design/page.tsx` |
| `colour_selected` | User changes the board colour in the configurator. | `app/design/page.tsx` |
| `thickness_selected` | User changes the board thickness in the configurator. | `app/design/page.tsx` |
| `order_initiated` | User clicks the Order button in the configurator, starting the checkout flow. | `app/design/page.tsx` |
| `cut_list_downloaded` | User downloads the production cut list in CSV or JSON format. | `app/order/page.tsx` |
| `order_placed` | User submits the order form — the primary conversion event. | `app/order/page.tsx` |
| `order_login_initiated` | User clicks 'Sign in with Google' on the order login page. | `app/order/login/page.tsx` |
| `order_login_skipped` | User clicks 'Continue as guest' on the order login page. | `app/order/login/page.tsx` |
| `login_initiated` | User clicks 'Sign in with Google' on the main login page. | `app/login/page.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/211145/dashboard/778251)
- [Checkout conversion funnel](https://eu.posthog.com/project/211145/insights/TBFntulO)
- [Orders over time](https://eu.posthog.com/project/211145/insights/af23Ug6x)
- [Configurator engagement](https://eu.posthog.com/project/211145/insights/yWyldDgr)
- [Login and auth events](https://eu.posthog.com/project/211145/insights/13OxbBVO)
- [Cut list downloads](https://eu.posthog.com/project/211145/insights/YXN5XhPP)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogIdentify` component in `providers.tsx` runs on every render with a session, so returning sessions should be covered, but verify with a real login flow.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
