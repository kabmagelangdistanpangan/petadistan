import { bbox } from "./gis";

export type RegionFilter = { kecamatan: string; desa: string };
export type SummaryItem = { label: string; value: number; unit: "Meter" | "Hektare" | "Objek/Blok" };
type Entry = { feature: any; kecamatan: string; desa: string; kondisi: string; panjang: number | null; luas: number | null };
type RegionIndex = { entries: Entry[]; hasPanjang: boolean; hasLuas: boolean; hasKondisi: boolean; hasRegion: boolean };
const cache = new WeakMap<object, RegionIndex>();
const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id");
const fieldName = (key: string) => normalize(key).replace(/[\s_-]/g, "");

/** Accept numeric attributes, not qualitative text; dots are decimal in machine data. */
export function attributeNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  let text = value.trim().replace(/\s/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (text.includes(",")) text = text.replace(",", ".");
  if (!/^\+?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function regionIndex(geo: any): RegionIndex {
  if (!geo || typeof geo !== "object") return { entries: [], hasPanjang: false, hasLuas: false, hasKondisi: false, hasRegion: false };
  const hit = cache.get(geo);
  if (hit) return hit;
  const index: RegionIndex = { entries: [], hasPanjang: false, hasLuas: false, hasKondisi: false, hasRegion: false };
  const features = geo.type === "FeatureCollection" ? geo.features : geo.type === "Feature" ? [geo] : [];
  for (const feature of features ?? []) {
    const props = new Map(Object.entries(feature?.properties ?? {}).map(([key, value]) => [fieldName(key), value]));
    const kecamatan = String(props.get("kecamatan") ?? props.get("namakecamatan") ?? props.get("wadmkc") ?? "").trim().replace(/\s+/g, " ");
    const desa = String(props.get("desa") ?? props.get("namadesa") ?? props.get("wadmkd") ?? "").trim().replace(/\s+/g, " ");
    index.hasPanjang ||= props.has("panjang");
    index.hasLuas ||= props.has("luas");
    index.hasKondisi ||= props.has("kondisi");
    index.hasRegion ||= !!kecamatan;
    index.entries.push({ feature, kecamatan, desa, kondisi: String(props.get("kondisi") ?? "").trim() || "Tanpa kondisi", panjang: attributeNumber(props.get("panjang")), luas: attributeNumber(props.get("luas")) });
  }
  cache.set(geo, index);
  return index;
}

export function regionOptions(data: any[], kecamatan = "") {
  const districts = new Map<string, string>();
  const villages = new Map<string, string>();
  for (const geo of data) for (const entry of regionIndex(geo).entries) {
    if (entry.kecamatan) districts.set(normalize(entry.kecamatan), entry.kecamatan);
    if (kecamatan && normalize(entry.kecamatan) === normalize(kecamatan) && entry.desa) villages.set(normalize(entry.desa), entry.desa);
  }
  const sort = (values: Map<string, string>) => [...values.values()].sort((a, b) => a.localeCompare(b, "id"));
  return { kecamatan: sort(districts), desa: sort(villages) };
}

function matches(entry: Entry, filter: RegionFilter) {
  return (!filter.kecamatan || normalize(entry.kecamatan) === normalize(filter.kecamatan)) && (!filter.desa || normalize(entry.desa) === normalize(filter.desa));
}

export function regionalView(geo: any, filter: RegionFilter) {
  const index = regionIndex(geo);
  const entries = filter.kecamatan || filter.desa ? index.entries.filter((entry) => matches(entry, filter)) : index.entries;
  const data = entries === index.entries ? geo : { type: "FeatureCollection", features: entries.map((entry) => entry.feature) };
  const summary: SummaryItem[] = [];
  if (index.hasPanjang) {
    if (index.hasKondisi) {
      const totals = new Map<string, { label: string; value: number }>();
      for (const entry of entries) {
        const key = normalize(entry.kondisi);
        const total = totals.get(key) ?? { label: entry.kondisi, value: 0 };
        total.value += entry.panjang ?? 0;
        totals.set(key, total);
      }
      for (const total of totals.values()) summary.push({ ...total, unit: "Meter" });
      if (!summary.length) summary.push({ label: "Total Panjang", value: 0, unit: "Meter" });
    } else summary.push({ label: "Total Panjang", value: entries.reduce((sum, entry) => sum + (entry.panjang ?? 0), 0), unit: "Meter" });
  }
  if (index.hasLuas) summary.push({ label: "Total Luas", value: entries.reduce((sum, entry) => sum + (entry.luas ?? 0), 0), unit: "Hektare" });
  if (!index.hasPanjang && !index.hasLuas) summary.push({ label: "Total", value: entries.length, unit: "Objek/Blok" });
  return { data, summary, count: entries.length, hasRegion: index.hasRegion, bounds: bbox(data) };
}

export function mergeRegionBounds(bounds: (ReturnType<typeof bbox>)[]): ReturnType<typeof bbox> {
  const valid = bounds.filter((bound) => bound !== null);
  if (!valid.length) return null;
  return [Math.min(...valid.map((b) => b[0])), Math.min(...valid.map((b) => b[1])), Math.max(...valid.map((b) => b[2])), Math.max(...valid.map((b) => b[3]))];
}

export const formatSummaryNumber = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
export type RegionBars = { metric: string; unit: SummaryItem["unit"]; bars: { name: string; value: number }[] };

/** Per-kecamatan bars district-wide, per-desa once a kecamatan is chosen; metric follows the layer's attributes (Luas > Panjang > count). */
export function regionBars(geo: any, filter: RegionFilter): RegionBars {
  const index = regionIndex(geo);
  const byDesa = !!filter.kecamatan;
  const metric = index.hasLuas ? "Luas" : index.hasPanjang ? "Panjang" : "Jumlah";
  const unit: SummaryItem["unit"] = index.hasLuas ? "Hektare" : index.hasPanjang ? "Meter" : "Objek/Blok";
  const groups = new Map<string, { name: string; value: number }>();
  for (const entry of index.entries) {
    if (!matches(entry, filter)) continue;
    const name = (byDesa ? entry.desa : entry.kecamatan) || "Tanpa nama";
    const group = groups.get(normalize(name)) ?? { name, value: 0 };
    group.value += index.hasLuas ? entry.luas ?? 0 : index.hasPanjang ? entry.panjang ?? 0 : 1;
    groups.set(normalize(name), group);
  }
  return { metric, unit, bars: [...groups.values()].sort((a, b) => b.value - a.value) };
}
