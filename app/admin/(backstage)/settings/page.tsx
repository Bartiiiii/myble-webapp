import { posthogProjectUrl } from "@/lib/backstageAnalytics";
import { Section } from "@/components/admin/ui";

// Integration health: presence checks only — values are never rendered.
function envSet(name: string): boolean {
  return Boolean(process.env[name]);
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-rose-50 text-rose-700 ring-rose-600/20"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
      {ok ? "configured" : "missing"}
    </span>
  );
}

export default async function BackstageSettings() {
  const supabaseHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
    } catch {
      return null;
    }
  })();
  const supabaseRef = supabaseHost?.split(".")[0];

  const checks: { group: string; items: { label: string; env: string[]; note?: string }[] }[] = [
    {
      group: "Authentication",
      items: [
        { label: "Google OAuth (NextAuth)", env: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] },
        { label: "Session signing secret", env: ["AUTH_SECRET"] },
        { label: "Backstage account", env: ["ADMIN_LOGIN", "ADMIN_PASSWORD_HASH"] },
      ],
    },
    {
      group: "Data",
      items: [
        { label: "Supabase project", env: ["NEXT_PUBLIC_SUPABASE_URL"] },
        { label: "Supabase service role (server writes)", env: ["SUPABASE_SERVICE_ROLE_KEY"] },
      ],
    },
    {
      group: "E-mail",
      items: [
        { label: "Resend API", env: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] },
        { label: "Newsletter topic", env: ["RESEND_NEWSLETTER_TOPIC_ID"] },
      ],
    },
    {
      group: "Analytics",
      items: [
        { label: "PostHog capture (site)", env: ["NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "NEXT_PUBLIC_POSTHOG_HOST"] },
        {
          label: "PostHog query key (backstage analytics)",
          env: ["POSTHOG_PERSONAL_API_KEY"],
          note: "Needed only for the Analytics page — see its setup card.",
        },
      ],
    },
  ];

  const links = [
    { label: "PostHog project", href: posthogProjectUrl },
    ...(supabaseRef ? [{ label: "Supabase dashboard", href: `https://supabase.com/dashboard/project/${supabaseRef}` }] : []),
    { label: "Resend dashboard", href: "https://resend.com/overview" },
    { label: "Vercel dashboard", href: "https://vercel.com/dashboard" },
    { label: "Live site", href: "https://my-ble.eu" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Integration health and quick links. Secrets are checked for presence only — never shown.</p>
      </header>

      {checks.map((group) => (
        <Section key={group.group} title={group.group}>
          <ul className="divide-y divide-zinc-50">
            {group.items.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{item.label}</p>
                  <p className="text-xs text-zinc-500">{item.env.join(" · ")}</p>
                  {item.note ? <p className="mt-0.5 text-xs text-zinc-400">{item.note}</p> : null}
                </div>
                <StatusDot ok={item.env.every(envSet)} />
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section title="Quick links">
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      </Section>

      <Section title="Security notes">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-700">
          <li>Backstage requires BOTH your Google account ({process.env.ADMIN_EMAIL ?? "bartek.kwasnica.2005@gmail.com"}) and the backstage password. Everyone else sees a 404.</li>
          <li>Backstage sessions last 12 hours and are HMAC-signed with <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">AUTH_SECRET</code> — rotating that secret signs everyone out instantly.</li>
          <li>The password is stored only as an scrypt hash (<code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">ADMIN_PASSWORD_HASH</code>). To change it, generate a new hash and update the env var on Vercel + locally.</li>
          <li>Login attempts are throttled: 5 failures per IP per 15 minutes.</li>
        </ul>
      </Section>
    </div>
  );
}
