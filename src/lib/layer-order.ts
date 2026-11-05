/** Sidebar order stays independent of download completion and active visibility. */
export function reconcileLayerOrder(ids: string[], previous: string[]): string[] {
  const valid = new Set(ids);
  const kept = previous.filter((id) => valid.has(id));
  const known = new Set(kept);
  // Sheet order: top sheet row first in sidebar = bottom of map stack.
  return [...kept, ...ids.filter((id) => !known.has(id))];
}

export function moveLayerOrder(order: string[], id: string, direction: -1 | 1): string[] {
  const from = order.indexOf(id);
  const to = from + direction;
  const target = order[to];
  if (from < 0 || !target) return order;
  const next = [...order];
  next[from] = target;
  next[to] = id;
  return next;
}

export function dragLayerOrder(order: string[], id: string, targetId: string): string[] {
  const from = order.indexOf(id);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return order;
  const next = order.filter((item) => item !== id);
  next.splice(to, 0, id);
  return next;
}

/** MapLibre inserts bottom-to-top; boundaries always remain the base. */
export function mapStackOrder<T extends { id: string; boundary?: boolean }>(sidebar: T[], manual: boolean): T[] {
  const data = sidebar.filter((layer) => !layer.boundary);
  return [...sidebar.filter((layer) => layer.boundary), ...(manual ? data : data.reverse())];
}

export function syncMapStack(
  map: { getLayer: (id: string) => unknown; moveLayer: (id: string) => unknown },
  layers: { id: string }[],
) {
  for (const layer of layers) {
    for (const kind of ["fill", "line", "pt", "lbl"]) {
      const id = `lyr-${layer.id}-${kind}`;
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }
}
/** Keep each category contiguous at its first appearance, so equal categories form one sidebar block. */
export function groupByCategory(order: string[], categoryOf: (id: string) => string): string[] {
  const blocks = new Map<string, string[]>();
  for (const id of order) {
    const kat = categoryOf(id).trim().toLocaleLowerCase("id");
    const block = blocks.get(kat) ?? [];
    block.push(id);
    blocks.set(kat, block);
  }
  return [...blocks.values()].flat();
}

/** Move a whole category block to the position of another category block. */
export function dragCategoryOrder(order: string[], categoryOf: (id: string) => string, from: string, to: string): string[] {
  const norm = (k: string) => k.trim().toLocaleLowerCase("id");
  const cats: string[] = [];
  for (const id of order) { const k = norm(categoryOf(id)); if (!cats.includes(k)) cats.push(k); }
  const a = cats.indexOf(norm(from));
  const b = cats.indexOf(norm(to));
  if (a < 0 || b < 0 || a === b) return order;
  cats.splice(a, 1);
  cats.splice(b, 0, norm(from));
  return cats.flatMap((k) => order.filter((id) => norm(categoryOf(id)) === k));
}
