import { bbox } from "./gis";
import { attributeNumber, regionIndex, type RegionFilter } from "./region-filter";

export const FERTILIZERS = [
  { key: "urea", label: "Urea", color: "#2563eb" },
  { key: "npk", label: "NPK", color: "#ea580c" },
  { key: "za", label: "Za", color: "#eab308" },
  { key: "organik", label: "Organik", color: "#15803d" },
  { key: "npkformula", label: "NPK Formula", color: "#c026d3" },
] as const;

export type FertKey = (typeof FERTILIZERS)[number]["key"];
export type FertValues = Record<FertKey, number>;
export type PieGroup = { name: string; center: [number, number]; values: FertValues; total: number };
export type FertilizerSeries = { id: string; nama: string; groups: PieGroup[] };

/** Match the actual map stack (bottom-to-top), ignoring hidden fertilizer layers. */
export function primaryFertilizerPies<T extends { id: string; hidden?: boolean }>(pies: T[], stack: { id: string; visible?: boolean }[]): T[] {
  const primary = [...stack].reverse().find((layer) => layer.visible !== false && pies.some((pie) => pie.id === layer.id && !pie.hidden));
  return primary ? pies.filter((pie) => pie.id === primary.id) : [];
}

export const pieDiameter = (total: number, max: number) => Math.round((22 + 30 * Math.sqrt(total / Math.max(1, max))) * 0.82);
export const absorptionPercent = (realization: number, allocation: number): number | null => allocation > 0 ? realization / allocation * 100 : null;
export const pieClickDistrict = (filter: RegionFilter, name: string): string | null => !filter.kecamatan && name !== "Tanpa nama" ? name : null;

/** Union regions by normalized name; absent series values are zero, zero denominators stay undefined. */
export function fertilizerComparison(series: FertilizerSeries[]) {
  const allocation = series.find((s) => /rdkk/i.test(s.nama) && !/realisasi/i.test(s.nama));
  const realizations = series.filter((s) => /realisasi/i.test(s.nama));
  const regions = new Map<string, { name: string; totals: Record<string, number> }>();
  for (const s of series) for (const group of s.groups) {
    const key = norm(group.name);
    const region = regions.get(key) ?? { name: group.name, totals: {} };
    region.totals[s.id] = (region.totals[s.id] ?? 0) + group.total;
    regions.set(key, region);
  }
  const totals = Object.fromEntries(series.map((s) => [s.id, s.groups.reduce((sum, g) => sum + g.total, 0)]));
  const percentages = (values: Record<string, number>) => allocation ? realizations.map((s) => ({ id: s.id, nama: s.nama, percent: absorptionPercent(values[s.id] ?? 0, values[allocation.id] ?? 0) })) : [];
  const bars = [...regions.values()].map((r) => ({ ...r, percentages: percentages(r.totals) })).sort((a, b) => Math.max(0, ...Object.values(b.totals)) - Math.max(0, ...Object.values(a.totals)));
  return { totals, percentages: percentages(totals), bars, max: Math.max(1, ...bars.flatMap((r) => Object.values(r.totals))) };
}

const fieldKey = (k: string) => k.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z]/g, "");
const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLocaleLowerCase("id");

/** Layers in the Pupuk category (or RDKK names, incl. future Realisasi RDKK) render as pies. */
export const isFertilizerLayer = (kategori: string, nama: string) => /pupuk|rdkk/i.test(`${kategori} ${nama}`);

/** Per-kecamatan groups district-wide; per-desa groups once a kecamatan is selected. */
export function fertilizerGroups(geo: any, filter: RegionFilter): PieGroup[] {
  const byDesa = !!filter.kecamatan;
  const groups = new Map<string, { name: string; features: any[]; values: FertValues }>();
  for (const e of regionIndex(geo).entries) {
    if (filter.kecamatan && norm(e.kecamatan) !== norm(filter.kecamatan)) continue;
    if (filter.desa && norm(e.desa) !== norm(filter.desa)) continue;
    const name = (byDesa ? e.desa : e.kecamatan) || "Tanpa nama";
    let g = groups.get(norm(name));
    if (!g) { g = { name, features: [], values: Object.fromEntries(FERTILIZERS.map((f) => [f.key, 0])) as FertValues }; groups.set(norm(name), g); }
    g.features.push(e.feature);
    for (const [k, v] of Object.entries(e.feature?.properties ?? {})) {
      const id = fieldKey(k);
      if (id in g.values) g.values[id as FertKey] += attributeNumber(v) ?? 0;
    }
  }
  return [...groups.values()].flatMap((g) => {
    const b = bbox({ type: "FeatureCollection", features: g.features });
    if (!b) return [];
    const total = Object.values(g.values).reduce((s, v) => s + v, 0);
    return [{ name: g.name, center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] as [number, number], values: g.values, total }];
  }).sort((a, b) => b.total - a.total);
}

export function pieGradient(values: FertValues, total: number) {
  if (!total) return "var(--muted)";
  let at = 0;
  const stops = FERTILIZERS.filter((f) => values[f.key]).map((f) => {
    const end = at + (values[f.key] / total) * 100;
    const s = `${f.color} ${at}% ${end}%`; at = end; return s;
  });
  return `conic-gradient(${stops.join(",")})`;
}

const nf = (v: number, d = 0) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(v);
export const formatKg = (kg: number) => (kg >= 1000 ? `${nf(kg / 1000, 2)} ton` : `${nf(kg)} kg`);
