// Contact graph + connectivity (the no-floating check, spec §6.5).
import { type Design, thicknessCm } from "../model";
import { inContact } from "./core";

export interface ContactGraph {
  /** adjacency[i] = indices of parts touching part i. */
  adjacency: number[][];
  /** Connected-component id per part index. */
  component: number[];
  /** Number of connected components. */
  components: number;
}

export function contactGraph(design: Design): ContactGraph {
  const parts = design.parts;
  const t = thicknessCm(design);
  const n = parts.length;
  const adjacency: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (inContact(parts[i], parts[j], t)) {
        adjacency[i].push(j);
        adjacency[j].push(i);
      }
    }
  }

  // Flood-fill connected components.
  const component = new Array(n).fill(-1);
  let comp = 0;
  for (let i = 0; i < n; i++) {
    if (component[i] !== -1) continue;
    const stack = [i];
    component[i] = comp;
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of adjacency[cur]) {
        if (component[nb] === -1) {
          component[nb] = comp;
          stack.push(nb);
        }
      }
    }
    comp++;
  }

  return { adjacency, component, components: n === 0 ? 0 : comp };
}

export interface Connectivity {
  connected: boolean;
  /** Indices of parts NOT in the largest connected component (the floaters). */
  floatingIds: string[];
}

/**
 * A design is connected when every part belongs to one component. A single part
 * (or empty) is trivially valid; only a genuinely detached part floats.
 */
export function connectivity(design: Design): Connectivity {
  const parts = design.parts;
  if (parts.length <= 1) return { connected: true, floatingIds: [] };

  const g = contactGraph(design);
  if (g.components <= 1) return { connected: true, floatingIds: [] };

  // Keep the largest component anchored; everything else is "floating".
  const sizes = new Array(g.components).fill(0);
  for (const c of g.component) sizes[c]++;
  let main = 0;
  for (let c = 1; c < g.components; c++) if (sizes[c] > sizes[main]) main = c;

  const floatingIds = parts.filter((_, i) => g.component[i] !== main).map((p) => p.id);
  return { connected: false, floatingIds };
}
