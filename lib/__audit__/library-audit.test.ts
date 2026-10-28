import { it } from "vitest";
import { LIBRARY } from "../library";
import { validateConfiguratorDesign } from "../rules-engine/configurator";
import { validate } from "../design";

it("audit", () => {
  const out: string[] = [];
  for (const item of LIBRARY) {
    const d = item.design;
    const v = validate(d);
    let rep: any;
    try { rep = validateConfiguratorDesign(d, { locale: "en" } as any); } catch (e) { rep = { error: String(e) }; }
    const findings = (rep.findings ?? []).map((f: any) => `${f.severity ?? f.status}:${f.rule_id ?? f.ruleId ?? f.id}:${(f.message ?? f.title ?? "").toString().slice(0, 90)}`);
    out.push(`## ${item.id} [${item.category}] ${d.outerCm.w}x${d.outerCm.h}x${d.outerCm.d} ${d.colour} parts=${d.parts.length} geomOk=${v.ok} floating=${v.floatingIds.length} orderable=${rep.orderable}`);
    for (const f of findings) out.push("   " + f);
    if (rep.error) out.push("   ERR " + rep.error);
  }
  console.log(out.join("\n"));
});
