import {
  type MebleBatch,
  type MebleFormatka,
  MEBLE_NOTES,
  drillBlock,
  drillFormFields,
  fieldLabel,
  mebleBatches,
  mirrorHints,
  type MebleItem,
} from "@/lib/mebleExport";
import { DOWEL } from "@/lib/drilling";
import { Section } from "@/components/admin/ui";

// The meble.pl hand-off, laid out as the two steps you actually perform on
// their site: upload the cut list, then type the drilling into each formatka.
// Everything that is reference rather than instruction starts folded away.
// Server component — a pure function of the designs.

function Fold({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-zinc-200">
      <summary className="flex cursor-pointer select-none items-baseline gap-2 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
        {title}
        {hint ? <span className="text-xs font-normal text-zinc-400">{hint}</span> : null}
      </summary>
      <div className="border-t border-zinc-100 p-4">{children}</div>
    </details>
  );
}

function StepHeading({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

/** One entry to type into their form: the field labels and the values, in order. */
function DrillEntry({
  index,
  fields,
  multi,
  hint,
}: {
  index: number;
  fields: ReturnType<typeof drillFormFields>;
  multi: boolean;
  hint?: string;
}) {
  // Label left, value right: one field per line puts every value you have to
  // type into a single column, which is what makes it quick to read down.
  return (
    <li className="rounded-lg bg-zinc-50 px-3 py-2">
      <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        Nawiert {index}
      </p>
      <dl className="space-y-0.5">
        {fields
          .filter((f) => !f.multiOnly || multi)
          .map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-3">
              <dt className="whitespace-nowrap text-[11px] leading-5 text-zinc-500">
                {fieldLabel(f, true)}
              </dt>
              <dd className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-zinc-900 ring-1 ring-zinc-200">
                {f.value}
              </dd>
            </div>
          ))}
      </dl>
      {hint ? <p className="mt-1.5 text-[11px] italic leading-4 text-indigo-600">or just: {hint}</p> : null}
    </li>
  );
}

/** Every hole on one formatka, grouped into meble's two drilling blocks. */
function FormatkaDrilling({ f }: { f: MebleFormatka }) {
  const hints = mirrorHints(f.drills, f);
  // Every formatka in an order repeats the order number; drop it from the row
  // label (the full code stays inside, and on meble's own label).
  const shortCode = f.code.startsWith(`${f.ref}-`) ? f.code.slice(f.ref.length + 1) : f.code;
  const holes = `${f.drills.reduce((n, r) => n + r.count, 0)} holes`;
  const blocks = new Map<string, { row: (typeof f.drills)[number]; i: number }[]>();
  f.drills.forEach((row, i) => {
    const key = drillBlock(row);
    const list = blocks.get(key);
    if (list) list.push({ row, i });
    else blocks.set(key, [{ row, i }]);
  });

  // One formatka at a time, because that is how their form works: open the one
  // you are filling in, keep the rest out of the way.
  return (
    <details className="group rounded-xl border border-zinc-200">
      {/* list-none + the webkit rule kill the browser's own ▸, which would
          otherwise sit next to our chevron on its own line. */}
      <summary className="flex cursor-pointer select-none list-none items-baseline gap-2 px-2.5 py-1.5 transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 text-[10px] text-zinc-400 transition group-open:rotate-90">▸</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-zinc-900">
          {shortCode}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-400">{holes}</span>
      </summary>
      <div className="space-y-3 border-t border-zinc-100 p-3">
        {/* The frame the numbers are in, stated where they are read. */}
        <p className="text-[10px] leading-4 text-zinc-500">
          <span className="font-mono text-zinc-700">{f.code}</span> ·{" "}
          <span className="font-mono">
            {f.widthMm}×{f.heightMm} mm · ×{f.quantity}
          </span>
          <br />
          Edges 1 = top, 2 = right, 3 = bottom, 4 = left. Wsp X from the left edge, Wsp Y from the
          bottom.
        </p>
        {[...blocks.entries()].map(([block, entries]) => (
          <div key={block}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              ☑ {block}
            </p>
            <ol className="space-y-1.5">
              {entries.map(({ row, i }, n) => (
                <DrillEntry
                  key={i}
                  index={n + 1}
                  fields={drillFormFields(row, f)}
                  multi={row.count > 1}
                  hint={hints.get(i)}
                />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </details>
  );
}

function BatchSteps({ batch, base }: { batch: MebleBatch; base: string }) {
  const drilled = batch.formatki.filter((f) => f.drills.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{batch.materialLabel}</h3>
        <p className="font-mono text-[11px] text-zinc-500">
          {batch.totals.formatki} formatki · {batch.totals.pieces} pieces · {batch.totals.holes} holes ·{" "}
          {batch.totals.dowels} dowels {DOWEL.diameterMm}×{DOWEL.lengthMm} mm
        </p>
      </div>

      {/* The two things you actually do on meble.pl, side by side — upload on
          the left, then work down the formatki on the right. */}
      <div className="grid gap-5 sm:grid-cols-2 sm:divide-x sm:divide-zinc-100">
        <div className="min-w-0">
          <StepHeading n={1} title="Upload the cut list">
            <p className="mb-2.5 text-xs leading-5 text-zinc-600">
              Rozkrój płyt → pick the <strong>{batch.materialLabel}</strong> board, set{" "}
              <strong>Obrzeże</strong>, then <strong>Wczytaj listę formatek z CSV</strong> →{" "}
              <em>zastąp bieżącą listę</em>.
            </p>
            <a
              href={`${base}&file=cutlist`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M8 2v8m0 0 3-3M8 10 5 7M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cut list CSV
            </a>

            <div className="mt-3 border-t border-zinc-100 pt-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">Also available</p>
              <div className="mt-1 flex flex-col gap-0.5 text-xs">
                <a className="font-medium text-indigo-600 hover:text-indigo-500" href={`${base}&file=drilling`}>
                  Drilling sheet (CSV) ↓
                </a>
                <a className="font-medium text-indigo-600 hover:text-indigo-500" href={`${base}&file=summary`}>
                  Covering note (TXT) ↓
                </a>
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-zinc-500">
                The same drilling entries as files — to print, or to send to cnc@meble.pl.
              </p>
            </div>
          </StepHeading>
        </div>

        <div className="min-w-0 sm:pl-5">
          <StepHeading n={2} title="Type the drilling">
            <p className="mb-2.5 text-xs leading-5 text-zinc-600">
              Per formatka: <strong>Szablon nawiertów → Wręgowanie i nawierty</strong>, tick the
              block, then <strong>+ dodaj nawiert</strong> per entry.
            </p>
            {drilled.length === 0 ? (
              <p className="text-xs text-zinc-500">Nothing to drill in this batch.</p>
            ) : (
              <div className="space-y-1.5">
                {drilled.map((f) => (
                  <FormatkaDrilling key={f.code} f={f} />
                ))}
              </div>
            )}
          </StepHeading>
        </div>
      </div>

      {batch.warnings.length > 0 ? (
        <ul className="space-y-1 rounded-xl bg-amber-50 p-4 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/20">
          {batch.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <Fold title="Full formatka list" hint={`${batch.totals.formatki} rows in the CSV`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Formatka</th>
                  <th className="px-3 py-2 font-medium">Size (mm)</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Banding</th>
                  <th className="py-2 pl-3 font-medium">Holes</th>
                </tr>
              </thead>
              <tbody>
                {batch.formatki.map((f) => (
                  <tr key={f.code} className="border-b border-zinc-50 last:border-0">
                    <td className="py-2 pr-3 font-mono text-zinc-900">{f.code}</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-zinc-600">
                      {f.widthMm}×{f.heightMm}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-zinc-600">{f.quantity}</td>
                    <td className="px-3 py-2 font-mono text-zinc-600">
                      {f.bandWidth}/{f.bandHeight}
                    </td>
                    <td className="py-2 pl-3 font-mono tabular-nums text-zinc-600">
                      {f.drills.reduce((n, r) => n + r.count, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Fold>
      </div>
    </div>
  );
}

export function MebleProduction({
  items,
  query,
  bare = false,
}: {
  items: MebleItem[];
  query: string;
  /** Skip the outer Section chrome — for embedding inside another box. */
  bare?: boolean;
}) {
  const batches = mebleBatches(items);
  if (batches.length === 0) {
    const empty = <p className="text-sm text-zinc-500">No readable design on this selection.</p>;
    return bare ? empty : <Section title="meble.pl production files">{empty}</Section>;
  }

  const body = (
    <div className="space-y-4">
      {batches.map((batch) => (
        <BatchSteps
          key={batch.materialId}
          batch={batch}
          base={`/api/admin/export/meble?${query}&material=${batch.materialId}`}
        />
      ))}

      <Fold title="Before the first order" hint="supplier conditions to confirm">
        <ul className="space-y-2 text-xs text-zinc-600">
          {MEBLE_NOTES.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      </Fold>
    </div>
  );

  return bare ? body : <Section title="meble.pl production files">{body}</Section>;
}
