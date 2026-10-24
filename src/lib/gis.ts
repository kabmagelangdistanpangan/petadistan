import proj4 from "proj4";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

export type MapRow = { id: string; nama: string; link: string; kategori: string; keterangan: string };

export const DEFAULT_SHEET =
  "https://docs.google.com/spreadsheets/d/1bwY_CkNt4DSdfZJWI4c69uuX6WVyHgm1cwKXPMMy1TU/edit?usp=sharing";

// Bright data palette for map layers.
export const PALETTE = [
  "#f43f5e", "#0ea5e9", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f97316", "#3b82f6", "#84cc16", "#eab308", "#ef4444",
];

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function rowsFromCSV(text: string): MapRow[] {
  const [head, ...body] = parseCSV(text);
  if (!head) return [];
  const h = head.map(norm);
  const find = (...keys: string[]) => h.findIndex((x) => keys.includes(x));
  const iNama = find("nama_peta", "nama", "judul");
  const iLink = find("link_geojson", "link_topojson", "link_json", "geojson", "topojson", "link");
  const iKat = find("kategori", "category");
  const iKet = find("keterangan", "deskripsi", "description");
  return body
    .map((r, idx) => ({
      id: `r${idx}`,
      nama: (r[iNama] ?? "").trim(),
      link: (r[iLink] ?? "").trim(),
      kategori: (r[iKat] ?? "").trim() || "Lainnya",
      keterangan: (r[iKet] ?? "").trim(),
    }))
    .filter((r) => r.nama && r.link);
}

export function parseSheetUrl(url: string): { id: string; gid: string } | null {
  const m = url.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const g = url.match(/[#&?]gid=(\d+)/);
  return { id: m[1]!, gid: g?.[1] ?? "" };
}

export function driveId(url: string): string | null {
  const m = url.match(/\/d\/([A-Za-z0-9_-]{10,})/) || url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return m?.[1] ?? null;
}

// Cache per link so uncheck/recheck and visibility toggles never re-download.
const geoCache = new Map<string, Promise<any>>();

export function downloadGeoJSON(link: string, onProgress: (loaded: number, total: number) => void) {
  const hit = geoCache.get(link);
  if (hit) return hit;
  const p = fetchGeoJSON(link, onProgress).catch((e) => { geoCache.delete(link); throw e; });
  geoCache.set(link, p);
  return p;
}

async function fetchGeoJSON(link: string, onProgress: (loaded: number, total: number) => void) {
  const id = driveId(link);
  const res = await fetch(id ? `/api/public/drive?id=${id}` : link);
  if (!res.ok) throw new Error((await res.text()) || `Gagal mengunduh (${res.status})`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body) return normalizeMapJSON(await res.json());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.length; onProgress(loaded, total);
  }
  const blob = new Blob(chunks as BlobPart[]);
  return normalizeMapJSON(JSON.parse(await blob.text()));
}

// Decode every TopoJSON object once; the rest of the map consumes GeoJSON only.
export function normalizeMapJSON(json: any) {
  if (json?.type === "Topology") {
    if (!json.objects || typeof json.objects !== "object" || Array.isArray(json.objects) || !Array.isArray(json.arcs))
      throw new Error("File TopoJSON tidak valid");
    try {
      const topology = json as Topology;
      const features = Object.values(topology.objects).flatMap((object) => {
        const converted = feature(topology, object);
        return converted.type === "FeatureCollection" ? converted.features : [converted];
      });
      if (!features.length) throw new Error("Tidak ada objek peta");
      const geo = { type: "FeatureCollection", features, ...(json.crs ? { crs: json.crs } : {}) };
      return toWGS84(geo);
    } catch {
      throw new Error("File TopoJSON tidak valid atau tidak berisi objek peta");
    }
  }
  if (!json || (json.type !== "FeatureCollection" && json.type !== "Feature"))
    throw new Error("File bukan GeoJSON atau TopoJSON yang valid");
  return toWGS84(json);
}

export function bbox(geo: any): [number, number, number, number] | null {
  let b: number[] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: any) => {
    if (typeof c[0] === "number") {
      b = [Math.min(b[0]!, c[0]), Math.min(b[1]!, c[1]), Math.max(b[2]!, c[0]), Math.max(b[3]!, c[1])];
    } else c.forEach(walk);
  };
  const visit = (g: any) => {
    if (!g) continue;
    if (g.type === "GeometryCollection") g.geometries.forEach(visit);
    else if (g.coordinates) walk(g.coordinates);
  };
  const feats = geo.type === "FeatureCollection" ? geo.features : [geo];
  for (const f of feats) visit(f?.geometry);
  return isFinite(b[0]!) ? (b as [number, number, number, number]) : null;
}

// Projected files (e.g. UTM meters) are converted to lon/lat. Without a crs, UTM 49S (Magelang area) is assumed.
export function toWGS84(geo: any) {
  const b = bbox(geo);
  if (!b || (Math.abs(b[0]) <= 180 && Math.abs(b[2]) <= 180 && Math.abs(b[1]) <= 90 && Math.abs(b[3]) <= 90)) return geo;
  const name: string = geo.crs?.properties?.name ?? "";
  const code = Number(name.match(/(\d{4,5})\s*$/)?.[1] ?? 32749);
  let def = "";
  if (code >= 32601 && code <= 32660) def = `+proj=utm +zone=${code - 32600} +datum=WGS84 +units=m +no_defs`;
  else if (code >= 32701 && code <= 32760) def = `+proj=utm +zone=${code - 32700} +south +datum=WGS84 +units=m +no_defs`;
  else if (code === 3857 || code === 900913) def = "EPSG:3857";
  else def = "+proj=utm +zone=49 +south +datum=WGS84 +units=m +no_defs";
  const t = proj4(def, "EPSG:4326");
  const walk = (c: any): any => (typeof c[0] === "number" ? t.forward([c[0], c[1]]) : c.map(walk));
  const visit = (g: any) => {
    if (!g) return;
    if (g.type === "GeometryCollection") g.geometries.forEach(visit);
    else if (g.coordinates) g.coordinates = walk(g.coordinates);
  };
  const feats = geo.type === "FeatureCollection" ? geo.features : [geo];
  for (const f of feats) visit(f?.geometry);
  delete geo.crs;
  return geo;
}
