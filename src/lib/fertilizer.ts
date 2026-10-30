import { bbox } from "./gis";
import { attributeNumber, regionIndex, type RegionFilter } from "./region-filter";

export const FERTILIZERS = [
  { key: "urea", label: "Urea", color: "#0ea5e9" },
  { key: "npk", label: "NPK", color: "#10b981" },
  { key: "za", label: "Za", color: "#f59e0b" },
  { key: "organik", label: "Organik", color: "#8b5cf6" },
  { key: "npkformula", label: "NPK Formula", color: "#e11d48" },
] as const;

export type PieGroup = { name: string; center: [number, number]; values: Record<string, number>; total: number };

const fieldKey = (k: string) => k.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z]/g, "");
const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLocaleLowerCase("id");

/** Layers in the Pupuk category (or RDKK names, incl. future Realisasi RDKK) render as pies. */
export const isFertilizerLayer = (kategori: string, nama: string) => /pupuk|rdkk/i.test(`${kategori} ${nama}`);

/** Per-kecamatan groups district-wide; per-desa groups once a kecamatan is selected. */
export function fertilizerGroups(geo: any, filter: RegionFilter): PieGroup[] {
  const byDesa = !!filter.kecamatan;
  const groups = new Map<string, { name: string; features: any[]; values: Record<string, number> }>();
  for (const e of regionIndex(geo).entries) {
    if (filter.kecamatan && norm(e.kecamatan) !== norm(filter.kecamatan)) continue;
    if (filter.desa && norm(e.desa) !== norm(filter.desa)) continue;
    const name = (byDesa ? e.desa : e.kecamatan) || "Tanpa nama";
    let g = groups.get(norm(name));
    if (!g) { g = { name, features: [], values: Object.fromEntries(FERTILIZERS.map((f) => [f.key, 0])) }; groups.set(norm(name), g); }
    g.features.push(e.feature);
    for (const [k, v] of Object.entries(e.feature?.properties ?? {})) {
      const id = fieldKey(k);
      if (id in g.values) g.values[id] += attributeNumber(v) ?? 0;
    }
  }
  return [...groups.values()].flatMap((g) => {
    const b = bbox({ type: "FeatureCollection", features: g.features });
    if (!b) return [];
    const total = Object.values(g.values).reduce((s, v) => s + v, 0);
    return [{ name: g.name, center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] as [number, number], values: g.values, total }];
  }).sort((a, b) => b.total - a.total);
}

export function pieGradient(values: Record<string, number>, total: number) {
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
