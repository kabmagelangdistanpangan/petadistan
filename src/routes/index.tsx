import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Search, Settings, RefreshCw, Layers, Satellite, Map as MapIcon, Loader2, AlertCircle, ChevronDown, X, Eye, EyeOff,
} from "lucide-react";
import { DEFAULT_SHEET, PALETTE, downloadGeoJSON, parseSheetUrl, rowsFromCSV, type MapRow } from "@/lib/gis";
import type { MapLayer } from "@/components/GisMap";

const GisMap = lazy(() => import("@/components/GisMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WebGIS Eksekutif — Distanpangan Kab. Magelang" },
      { name: "description", content: "Dashboard peta interaktif untuk pimpinan: data real-time dari Google Sheets dan GeoJSON Google Drive." },
      { property: "og:title", content: "WebGIS Eksekutif — Distanpangan Kab. Magelang" },
      { property: "og:description", content: "Dashboard peta interaktif untuk pimpinan dengan layer GeoJSON otomatis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Active = { status: "loading" | "ready" | "error"; loaded: number; total: number; color: string; data?: any; error?: string; hidden?: boolean };

function fmt(n: number) { return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`; }

function Index() {
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET);
  const [draft, setDraft] = useState(DEFAULT_SHEET);
  const [showSettings, setShowSettings] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Record<string, Active>>({});
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const s = localStorage.getItem("gis-sheet-url");
    if (s) { setSheetUrl(s); setDraft(s); }
  }, []);

  const sheet = useQuery({
    queryKey: ["sheet", sheetUrl],
    queryFn: async () => {
      const p = parseSheetUrl(sheetUrl);
      if (!p) throw new Error("URL Google Sheets tidak valid");
      const res = await fetch(`/api/public/sheet?id=${p.id}&gid=${p.gid}`);
      if (!res.ok) throw new Error(await res.text());
      return rowsFromCSV(await res.text());
    },
    refetchInterval: 60_000,
  });

  const rows = sheet.data ?? [];
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const g: Record<string, MapRow[]> = {};
    for (const r of rows) {
      if (s && !`${r.nama} ${r.kategori} ${r.keterangan}`.toLowerCase().includes(s)) continue;
      (g[r.kategori] ??= []).push(r);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, q]);

  const patch = (id: string, v: Partial<Active>) =>
    setActive((a) => (a[id] ? { ...a, [id]: { ...a[id]!, ...v } as Active } : a));

  const toggle = async (r: MapRow) => {
    if (active[r.id]) {
      setActive(({ [r.id]: _, ...rest }) => rest);
      return;
    }
    const used = new Set(Object.values(active).map((a) => a.color));
    const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[Object.keys(active).length % PALETTE.length]!;
    setActive((a) => ({ ...a, [r.id]: { status: "loading", loaded: 0, total: 0, color } }));
    try {
      const data = await downloadGeoJSON(r.link, (loaded, total) =>
        patch(r.id, { loaded, total }));
      patch(r.id, { status: "ready", data });
      setFocus({ id: r.id, n: Date.now() });
    } catch (e) {
      patch(r.id, { status: "error", error: (e as Error).message });
    }
  };

  const mapLayers: MapLayer[] = rows
    .filter((r) => active[r.id]?.status === "ready")
    .map((r) => ({ id: r.id, data: active[r.id]!.data, color: active[r.id]!.color, nama: r.nama, keterangan: r.keterangan, visible: !active[r.id]!.hidden }));
  const loadingCount = Object.values(active).filter((a) => a.status === "loading").length;

  const saveSettings = () => {
    localStorage.setItem("gis-sheet-url", draft);
    setSheetUrl(draft); setActive({}); setShowSettings(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-border bg-sidebar">
        <header className="bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/15"><Layers className="h-5 w-5" /></div>
              <div>
                <h1 className="text-base font-semibold leading-tight">WebGIS Eksekutif</h1>
                <p className="text-xs opacity-75">Distanpangan Kab. Magelang</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button aria-label="Muat ulang data" onClick={() => sheet.refetch()} className="rounded-md p-2 hover:bg-primary-foreground/15">
                <RefreshCw className={`h-4 w-4 ${sheet.isFetching ? "animate-spin" : ""}`} />
              </button>
              <button aria-label="Pengaturan" onClick={() => setShowSettings((s) => !s)} className="rounded-md p-2 hover:bg-primary-foreground/15">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {showSettings && (
          <div className="space-y-2 border-b border-border bg-card p-4">
            <label className="text-xs font-medium text-muted-foreground">URL Google Sheets (share link)</label>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
              className="w-full resize-none rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
            <div className="flex gap-2">
              <button onClick={saveSettings} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Simpan & Muat</button>
              <button onClick={() => setDraft(DEFAULT_SHEET)} className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent">Default</button>
            </div>
          </div>
        )}

        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari peta…"
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {q && <button aria-label="Hapus pencarian" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{rows.length} peta · {mapLayers.length} aktif</span>
            {Object.keys(active).length > 0 && <button onClick={() => setActive({})} className="font-medium text-primary hover:underline">Matikan semua</button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {sheet.isLoading && <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Membaca Google Sheets…</div>}
          {sheet.error && <div className="m-2 flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{(sheet.error as Error).message}</div>}
          {!sheet.isLoading && !sheet.error && groups.length === 0 && <p className="p-4 text-sm text-muted-foreground">Tidak ada peta ditemukan.</p>}
          {groups.map(([kat, items]) => (
            <section key={kat} className="mb-3">
              <button onClick={() => setCollapsed((c) => ({ ...c, [kat]: !c[kat] }))}
                className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{kat} <span className="font-normal">({items.length})</span></span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsed[kat] ? "-rotate-90" : ""}`} />
              </button>
              {!collapsed[kat] && (
                <ul className="space-y-1">
                  {items.map((r) => {
                    const a = active[r.id];
                    return (
                      <li key={r.id} className={`rounded-lg border transition-colors ${a ? "border-primary/30 bg-card shadow-sm" : "border-transparent hover:bg-accent"}`}>
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                          <input type="checkbox" checked={!!a} onChange={() => toggle(r)} className="mt-0.5 h-4 w-4 accent-primary" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium leading-snug">{r.nama}</div>
                            {r.keterangan && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.keterangan}</div>}
                          </div>
                          {a?.status === "ready" && (
                            <button aria-label="Fokus ke peta" onClick={(e) => { e.preventDefault(); setFocus({ id: r.id, n: Date.now() }); }}
                              className="text-muted-foreground hover:text-primary"><Eye className="h-4 w-4" /></button>
                          )}
                        </label>
                        {a && (
                          <div className="px-3 pb-2.5 pl-10">
                            {a.status === "loading" && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" />Mengunduh {a.loaded ? fmt(a.loaded) : ""}{a.total ? ` / ${fmt(a.total)}` : "…"}</div>
                                <div className="h-1 overflow-hidden rounded-full bg-muted">
                                  <div className={`h-full bg-primary transition-all ${a.total ? "" : "w-1/3 animate-pulse"}`} style={a.total ? { width: `${(a.loaded / a.total) * 100}%` } : undefined} />
                                </div>
                              </div>
                            )}
                            {a.status === "ready" && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="h-3 w-5 rounded-sm border" style={{ backgroundColor: a.color, opacity: 0.75, borderColor: a.color }} />
                                {(a.data?.features?.length ?? 1).toLocaleString("id-ID")} objek
                              </div>
                            )}
                            {a.status === "error" && <div className="flex gap-1.5 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{a.error}</div>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
        <footer className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Data diperbarui otomatis tiap 60 detik</footer>
      </aside>

      <main className="relative flex-1">
        <ClientOnly fallback={<div className="grid h-full place-items-center bg-muted"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
          <Suspense fallback={<div className="grid h-full place-items-center bg-muted"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <GisMap layers={mapLayers} focus={focus} satellite={satellite} />
          </Suspense>
        </ClientOnly>

        <div className="absolute left-4 top-4 flex overflow-hidden rounded-lg border border-border bg-card shadow-md">
          <button onClick={() => setSatellite(false)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${!satellite ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            <MapIcon className="h-3.5 w-3.5" />Peta
          </button>
          <button onClick={() => setSatellite(true)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${satellite ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            <Satellite className="h-3.5 w-3.5" />Satelit
          </button>
        </div>

        {loadingCount > 0 && (
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />Memuat {loadingCount} layer…
          </div>
        )}
        {mapLayers.length === 0 && loadingCount === 0 && !sheet.isLoading && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card/95 px-4 py-2 text-xs text-muted-foreground shadow-md">
            <EyeOff className="h-3.5 w-3.5" />Centang peta di panel kiri untuk menampilkan
          </div>
        )}
      </main>
    </div>
  );
}
