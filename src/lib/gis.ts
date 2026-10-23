export type MapRow = { id: string; nama: string; link: string; kategori: string; keterangan: string };

export const DEFAULT_SHEET =
  "https://docs.google.com/spreadsheets/d/1bwY_CkNt4DSdfZJWI4c69uuX6WVyHgm1cwKXPMMy1TU/edit?usp=sharing";

// Corporate/pastel data palette for map layers.
export const PALETTE = [
  "#3b6ea5", "#e07a5f", "#81b29a", "#f2cc8f", "#9b8ec4", "#5fa8d3",
  "#d4a5a5", "#6d9886", "#e9a46a", "#7d8cc4", "#c38d9e", "#4ea8a0",
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
  const iLink = find("link_geojson", "link_json", "geojson", "link");
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
  return { id: m[1], gid: g ? g[1] : "" };
}

export function driveId(url: string): string | null {
  const m = url.match(/\/d\/([A-Za-z0-9_-]{10,})/) || url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

export async function downloadGeoJSON(link: string, onProgress: (loaded: number, total: number) => void) {
  const id = driveId(link);
  const res = await fetch(id ? `/api/public/drive?id=${id}` : link);
  if (!res.ok) throw new Error((await res.text()) || `Gagal mengunduh (${res.status})`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body) return res.json();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.length; onProgress(loaded, total);
  }
  const blob = new Blob(chunks as BlobPart[]);
  const json = JSON.parse(await blob.text());
  if (!json || (json.type !== "FeatureCollection" && json.type !== "Feature"))
    throw new Error("File bukan GeoJSON yang valid");
  return json;
}

export function bbox(geo: any): [number, number, number, number] | null {
  let b: number[] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: any) => {
    if (typeof c[0] === "number") {
      b = [Math.min(b[0]!, c[0]), Math.min(b[1]!, c[1]), Math.max(b[2]!, c[0]), Math.max(b[3]!, c[1])];
    } else c.forEach(walk);
  };
  const feats = geo.type === "FeatureCollection" ? geo.features : [geo];
  for (const f of feats) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === "GeometryCollection") g.geometries.forEach((x: any) => walk(x.coordinates));
    else if (g.coordinates) walk(g.coordinates);
  }
  return isFinite(b[0]!) ? (b as [number, number, number, number]) : null;
}
