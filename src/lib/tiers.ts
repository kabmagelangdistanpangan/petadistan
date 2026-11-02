// Tiered (classified) layers: auto-detect a categorical attribute such as
// Ketinggian (Tinggi/Sedang/Rendah) or Kondisi (Baik/Sedang/Rusak).

export type TierInfo = { field: string; values: string[] };
export type TierSetting = { enabled: boolean; field?: string; colors: Record<string, string> };

const SKIP = /^(kabupaten|kab|kecamatan|kec|desa|kelurahan|namadesa|namakecamatan|wadm\w*|provinsi|id|fid|objectid|nama\w*|name|keterangan|ket|remark|link|url|kode\w*)$/;
const PREFER = /ketinggian|elevasi|kelas|zona|kondisi|status|tingkat|rawan|kerawanan|klasifikasi|kategori|level|kerusakan/;
const key = (k: string) => k.toLowerCase().replace(/[\s_-]/g, "");
const cache = new WeakMap<object, TierInfo[]>();

/** All categorical fields with 2–8 distinct text values, preferred names first. */
export function tierFields(geo: any): TierInfo[] {
  if (!geo || typeof geo !== "object") return [];
  const hit = cache.get(geo);
  if (hit) return hit;
  const feats: any[] = geo.type === "FeatureCollection" ? geo.features ?? [] : [];
  const values = new Map<string, Map<string, string>>();
  const numeric = new Set<string>();
  for (const f of feats) {
    for (const [k, v] of Object.entries(f?.properties ?? {})) {
      if (SKIP.test(key(k))) continue;
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "number" || /^-?\d+([.,]\d+)?$/.test(String(v).trim())) { numeric.add(k); continue; }
      const s = String(v).trim().replace(/\s+/g, " ");
      const m = values.get(k) ?? new Map<string, string>();
      if (m.size <= 8) m.set(s.toLocaleLowerCase("id"), s);
      values.set(k, m);
    }
  }
  const out = [...values.entries()]
    .filter(([k, m]) => !numeric.has(k) && m.size >= 2 && m.size <= 8)
    .map(([field, m]) => ({ field, values: sortTiers([...m.values()]) }))
    .sort((a, b) => Number(PREFER.test(key(b.field))) - Number(PREFER.test(key(a.field))));
  cache.set(geo, out);
  return out;
}

const RANK: [RegExp, number][] = [
  [/sangat\s*tinggi|sangat\s*rawan|rusak\s*berat/i, 0],
  [/tinggi|rusak(?!\s*ringan)|buruk|rawan(?!\s*rendah)/i, 1],
  [/rusak\s*ringan/i, 2],
  [/sedang|cukup|menengah/i, 3],
  [/rendah|baik|aman|ringan/i, 4],
];
const rank = (v: string) => RANK.find(([re]) => re.test(v))?.[1] ?? 9;
export const sortTiers = (vals: string[]) => [...vals].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "id"));

const FALLBACK = ["#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#9333ea", "#0891b2", "#db2777", "#65a30d"];
export function defaultTierColor(value: string, index: number, field = ""): string {
  const v = value.toLowerCase();
  const elev = /ketinggian|elevasi|dataran/i.test(`${field} ${value}`);
  if (/rusak\s*berat|sangat\s*rawan/.test(v)) return "#7f1d1d";
  if (/rusak\s*ringan/.test(v)) return "#f97316";
  if (/rusak|buruk/.test(v)) return "#dc2626";
  if (/baik|aman/.test(v)) return "#16a34a";
  if (elev) {
    if (/sangat\s*tinggi/.test(v)) return "#7c2d12";
    if (/tinggi/.test(v)) return "#b45309";
    if (/sedang/.test(v)) return "#eab308";
    if (/rendah/.test(v)) return "#22c55e";
  }
  if (/tinggi|rawan/.test(v)) return "#dc2626";
  if (/sedang|cukup/.test(v)) return "#f59e0b";
  if (/rendah|ringan/.test(v)) return "#16a34a";
  return FALLBACK[index % FALLBACK.length]!;
}

export function tierColors(info: TierInfo, manual: Record<string, string> = {}) {
  return info.values.map((value, i) => ({ value, color: manual[value] ?? defaultTierColor(value, i, info.field) }));
}

/** MapLibre match expression on the tier attribute; unmatched features keep the layer color. */
export function tierExpression(field: string, colors: { value: string; color: string }[], fallback: string): any {
  if (!colors.length) return fallback;
  const pairs = colors.flatMap((c) => [c.value, c.color]);
  return ["match", ["to-string", ["get", field]], ...pairs, fallback];
}
