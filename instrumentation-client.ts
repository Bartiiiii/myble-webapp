import { maybeInitPostHog } from "./lib/posthogClient";

// B6: do NOT initialise PostHog on page load. It is started lazily only after
// the visitor grants analytics consent (see lib/consent.tsx). For a RETURNING
// visitor who already granted consent, this re-enables it early.
maybeInitPostHog();
