// Server-only helpers to load the verbatim legal markdown from `legal-source/`.
// Kept separate from `lib/legal.ts` (which is client-safe) so `fs` never leaks
// into a client bundle — only ever imported by the `app/legal/[doc]` server
// component. Uses `node:fs`, which pins it to the server automatically.
import fs from "node:fs";
import path from "node:path";
import { type LegalSlug } from "./legal";

const ROOT = path.join(process.cwd(), "legal-source");

/** Read the raw markdown for a document in both locales. */
export function readLegalMarkdown(slug: LegalSlug): { en: string; cs: string } {
  return {
    en: fs.readFileSync(path.join(ROOT, "en", `${slug}.md`), "utf8"),
    cs: fs.readFileSync(path.join(ROOT, "cz", `${slug}.md`), "utf8"),
  };
}
