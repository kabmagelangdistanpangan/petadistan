/** Sidebar order stays independent of download completion and active visibility. */
export function reconcileLayerOrder(ids: string[], previous: string[]): string[] {
  const valid = new Set(ids);
  const kept = previous.filter((id) => valid.has(id));
  const known = new Set(kept);
  return [...ids.filter((id) => !known.has(id)).reverse(), ...kept];
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