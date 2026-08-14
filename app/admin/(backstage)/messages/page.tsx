import { fetchMessages } from "@/lib/backstageData";
import { EmptyState, ExportButton, formatDate } from "@/components/admin/ui";
import { MessageHandledToggle } from "@/components/admin/BackstageControls";

export default async function BackstageMessages() {
  const messages = await fetchMessages();
  const open = messages.filter((m) => !m.handled_at);
  const handled = messages.filter((m) => m.handled_at);

  function MessageCard({ m }: { m: (typeof messages)[number] }) {
    return (
      <article className={`rounded-2xl bg-white p-5 ring-1 ring-zinc-200 ${m.handled_at ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">{m.name}</p>
            <a href={`mailto:${m.email}`} className="text-sm text-indigo-600 hover:text-indigo-500">{m.email}</a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{formatDate(m.created_at)} · {m.locale.toUpperCase()}</span>
            <MessageHandledToggle messageId={m.id} handled={Boolean(m.handled_at)} />
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{m.message}</p>
        {m.handled_at ? <p className="mt-2 text-xs text-zinc-400">Handled {formatDate(m.handled_at)}</p> : null}
      </article>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="mt-1 text-sm text-zinc-500">{open.length} open · {handled.length} handled</p>
        </div>
        <ExportButton what="messages" />
      </header>

      {messages.length === 0 ? (
        <EmptyState text="No contact messages yet." />
      ) : (
        <div className="space-y-4">
          {open.map((m) => <MessageCard key={m.id} m={m} />)}
          {handled.length > 0 ? (
            <details className="pt-2">
              <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-700">
                Handled ({handled.length})
              </summary>
              <div className="mt-4 space-y-4">
                {handled.map((m) => <MessageCard key={m.id} m={m} />)}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
