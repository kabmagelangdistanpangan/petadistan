import { BOUNDARY_FILL, BOUNDARY_LINE, PALETTE, isBoundaryLayer } from "./gis";

// Cartographic data colors are separate from interface theme tokens.
export function defaultLayerColor(name: string, index = 0): string {
  if (isBoundaryLayer(name)) return BOUNDARY_FILL;
  if (/primer/i.test(name)) return "#0077cc";
  if (/sekunder/i.test(name)) return "#0091ff";
  if (/tersier/i.test(name)) return "#38bdf8";
  if (/nasional/i.test(name)) return "#e11d48";
  if (/provinsi/i.test(name)) return "#f97316";
  if (/kabupaten/i.test(name)) return "#fb923c";
  if (/lp2b/i.test(name)) return "#10b981";
  if (/padi/i.test(name)) return "#22c55e";
  return PALETTE[index % PALETTE.length] ?? BOUNDARY_FILL;
}

export function resolveLayerColor(name: string, index: number, manual?: string): string {
  return manual && /^#[\da-f]{6}$/i.test(manual) ? manual : defaultLayerColor(name, index);
}

export function layerPaintColors(layer: { color: string; boundary?: boolean; manualColor?: boolean }) {
  return {
    fill: layer.color,
    stroke: layer.boundary && !layer.manualColor ? BOUNDARY_LINE : layer.color,
    fillOpacity: layer.boundary ? 0.4 : 0.6,
  };
}