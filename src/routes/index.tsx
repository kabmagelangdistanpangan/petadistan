import { parseCoordinate } from "@/lib/coords";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type CollisionDetection } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Search, Settings, RefreshCw, Satellite, Map as MapIcon, Loader2, AlertCircle, ChevronDown, X, Eye, EyeOff, RotateCcw, BarChart3, PanelLeftClose, PanelLeftOpen, MapPin,
  Crosshair,
} from "lucide-react";
import { DEFAULT_SHEET, downloadGeoJSON, isBoundaryLayer, parseSheetUrl, rowsFromCSV, type MapRow } from "@/lib/gis";
import { resolveLayerColor } from "@/lib/layer-colors";
import { regionalView, regionOptions, mergeRegionBounds, formatSummaryNumber, regionBars, type RegionFilter } from "@/lib/region-filter";
import { FERTILIZERS, fertilizerGroups, isFertilizerLayer, primaryFertilizerPies } from "@/lib/fertilizer";
import { tierColors, tierFields, type TierSetting } from "@/lib/tiers";
import { SummaryDrawer } from "@/components/SummaryDrawer";
import { RegionControls } from "@/components/RegionControls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { MapLayer } from "@/components/GisMap";
import { SortableLayer, SortableCategory } from "@/components/SortableLayer";
import { dragCategoryOrder, dragLayerOrder, groupByCategory, mapStackOrder, reconcileLayerOrder, sheetSidebarOrder } from "@/lib/layer-order";

// Category handles only collide with categories, layer handles only with layers.
const sameKindCollision: CollisionDetection = (args) => {
  const isKat = String(args.active.id).startsWith("kat:");
  return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith("kat:") === isKat) });
};
import logo from "@/assets/logo-magelang.png";

const GisMap = lazy(() => import("@/components/GisMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WebGIS Eksekutif — Distan dan Pangan Kab. Magelang" },
      { name: "description", content: "Dashboard peta interaktif untuk pimpinan: data real-time dari Google Sheets serta GeoJSON dan TopoJSON Google Drive." },
      { property: "og:title", content: "WebGIS Eksekutif — Distan dan Pangan Kab. Magelang" },
      { property: "og:description", content: "Dashboard peta interaktif untuk pimpinan dengan layer GeoJSON dan TopoJSON otomatis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Active = { status: "loading" | "ready" | "error"; loaded: number; total: number; color: string; data?: any; error?: string; hidden?: boolean; open?: boolean; label?: string | undefined };

function fmt(n: number) { return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`; }

const keyCache = new WeakMap<object, string[]>();
function propKeys(geo: any): string[] {
  if (!geo) return [];
  const hit = keyCache.get(geo);
  if (hit) return hit;
  const feats = geo.type === "FeatureCollection" ? geo.features : [geo];
  const s = new Set<string>();
  for (const f of feats.slice(0, 200)) Object.keys(f?.properties ?? {}).forEach((k) => s.add(k));
  const out = [...s];
  keyCache.set(geo, out);
  return out;
}

function Index() {
  const sheetUrl = DEFAULT_SHEET;
  const [q, setQ] = useState("");
  const [pin, setPin] = useState<[number, number] | null>(null);
  const coord = useMemo(() => parseCoordinate(q), [q]);
  const clearSearch = () => { setQ(""); setPin(null); };
  const [active, setActive] = useState<Record<string, Active>>({});
  const [manualColors, setManualColors] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState<Record<string, TierSetting>>({});
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [satellite, setSatellite] = useState<false | "google" | "esri">(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [layerOrder, setLayerOrder] = useState<string[]>([]);
  const [manualOrder, setManualOrder] = useState(false);
  const [region, setRegion] = useState<RegionFilter>({ kecamatan: "", desa: "" });
  const [regionZoomRequest, setRegionZoomRequest] = useState(0);
  const [chartOpen, setChartOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );


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
  const katOf = useMemo(() => {
    const m = new Map(rows.map((r) => [r.id, r.kategori || "Lainnya"]));
    return (id: string) => m.get(id) ?? "Lainnya";
  }, [rows]);
  const order = useMemo(() => groupByCategory(reconcileLayerOrder(sheetSidebarOrder(rows.map((r) => r.id), katOf), layerOrder), katOf), [rows, layerOrder, katOf]);
  const orderedRows = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    return order.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }, [rows, order]);
  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over) return;
    const from = String(dragged.id), to = String(over.id);
    let next: string[];
    if (from.startsWith("kat:")) {
      if (!to.startsWith("kat:")) return;
      next = dragCategoryOrder(order, katOf, from.slice(4), to.slice(4));
    } else {
      if (to.startsWith("kat:") || katOf(from).toLowerCase() !== katOf(to).toLowerCase()) return;
      next = dragLayerOrder(order, from, to);
    }
    if (next === order) return;
    setLayerOrder(next);
    setManualOrder(true);
  };
  const groups = useMemo(() => {
    const s = coord ? "" : q.trim().toLowerCase();
    const g: [string, MapRow[]][] = [];
    for (const r of orderedRows) {
      if (s && !`${r.nama} ${r.kategori} ${r.keterangan}`.toLowerCase().includes(s)) continue;
      const kat = r.kategori || "Lainnya";
      const hit = g.find(([k]) => k.toLowerCase() === kat.toLowerCase());
      if (hit) hit[1].push(r);
      else g.push([kat, [r]]);
    }
    return g;
  }, [orderedRows, q]);

  const patch = (id: string, v: Partial<Active>) =>
    setActive((a) => (a[id] ? { ...a, [id]: { ...a[id], ...v } as Active } : a));

  const colorFor = (r: MapRow) => resolveLayerColor(r.nama, rows.filter((row) => !isBoundaryLayer(row.nama)).findIndex((row) => row.id === r.id), manualColors[r.id]);
  const tierInfoFor = (id: string, data: any) => {
    const options = tierFields(data);
    const want = tiers[id]?.field;
    return options.find((o) => o.field === want) ?? options[0];
  };
  const activeTierColors = (id: string, data: any) => {
    const info = tierInfoFor(id, data);
    if (!info || tiers[id]?.enabled === false) return null;
    return tierColors(info, tiers[id]?.colors);
  };
  const setTier = (id: string, v: Partial<TierSetting>) =>
    setTiers((all) => ({ ...all, [id]: { enabled: true, colors: {}, ...all[id], ...v } }));

  const toggle = async (r: MapRow) => {
    if (active[r.id]) {
      setActive(({ [r.id]: _, ...rest }) => rest);
      return;
    }
    const color = colorFor(r);
    setActive((a) => ({ ...a, [r.id]: { status: "loading", loaded: 0, total: 0, color } }));
    try {
      const data = await downloadGeoJSON(r.link, (loaded, total) =>
        patch(r.id, { loaded, total }));
      patch(r.id, { status: "ready", data });
    } catch (e) {
      patch(r.id, { status: "error", error: (e as Error).message });
    }
  };

  const checkedData = useMemo(() => orderedRows.flatMap((r) => {
    const a = active[r.id];
    return a?.status === "ready" ? [a.data] : [];
  }), [orderedRows, active]);
  const regionChoices = useMemo(() => regionOptions(checkedData, region.kecamatan), [checkedData, region.kecamatan]);
  const effectiveRegion = useMemo(() => {
    if (!regionChoices.kecamatan.includes(region.kecamatan)) return { kecamatan: "", desa: "" };
    return { kecamatan: region.kecamatan, desa: regionChoices.desa.includes(region.desa) ? region.desa : "" };
  }, [region, regionChoices]);
  useEffect(() => {
    if (region.kecamatan !== effectiveRegion.kecamatan || region.desa !== effectiveRegion.desa) setRegion(effectiveRegion);
  }, [region, effectiveRegion]);
  const regionalViews = useMemo(() => Object.fromEntries(orderedRows.flatMap((r) => {
    const a = active[r.id];
    return a?.status === "ready" ? [[r.id, regionalView(a.data, effectiveRegion, tierInfoFor(r.id, a.data)?.field)]] : [];
  })), [orderedRows, active, effectiveRegion, tiers]);
  const mapLayers: MapLayer[] = useMemo(() => mapStackOrder(orderedRows.flatMap((r) => {
    const a = active[r.id];
    if (a?.status !== "ready") return [];
    const tc = activeTierColors(r.id, a.data);
    const tier = tc ? { field: tierInfoFor(r.id, a.data)!.field, colors: tc } : undefined;
    return [{ id: r.id, data: regionalViews[r.id]?.data ?? a.data, color: colorFor(r), manualColor: !!manualColors[r.id], nama: r.nama, keterangan: r.keterangan, visible: !a.hidden, label: a.label, boundary: isBoundaryLayer(r.nama), pie: isFertilizerLayer(r.kategori, r.nama), tier }];
  }), false), [orderedRows, active, manualColors, manualOrder, regionalViews, tiers]);
  const pies = useMemo(() => orderedRows.flatMap((r) => {
    const a = active[r.id];
    if (a?.status !== "ready" || !isFertilizerLayer(r.kategori, r.nama)) return [];
    return [{ id: r.id, nama: r.nama, hidden: !!a.hidden, groups: fertilizerGroups(a.data, effectiveRegion) }];
  }), [orderedRows, active, effectiveRegion]);
  const mapPies = useMemo(() => primaryFertilizerPies(pies, mapLayers), [pies, mapLayers]);
  const recaps = useMemo(() => orderedRows.flatMap((r) => {
    const a = active[r.id];
    const v = regionalViews[r.id];
    return a?.status === "ready" && v && !isFertilizerLayer(r.kategori, r.nama) ? [{ id: r.id, nama: r.nama, color: colorFor(r), count: v.count, summary: v.summary, chart: regionBars(a.data, effectiveRegion) }] : [];
  }), [orderedRows, active, regionalViews, manualColors, effectiveRegion]);
  const pickRegion = (name: string) => changeRegion(effectiveRegion.kecamatan ? { ...effectiveRegion, desa: name } : { kecamatan: name, desa: "" });
  const regionBounds = useMemo(() => mergeRegionBounds(orderedRows.flatMap((r) => {
    const a = active[r.id];
    return a?.status === "ready" && !a.hidden ? [regionalViews[r.id]?.bounds ?? null] : [];
  })), [orderedRows, active, regionalViews]);
  const regionScope = effectiveRegion.desa || effectiveRegion.kecamatan || "Se-Kabupaten";
  const changeRegion = (next: RegionFilter) => {
    setRegion(next);
    setRegionZoomRequest((request) => request + 1);
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const loadingCount = Object.values(active).filter((a) => a.status === "loading").length;


  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <aside aria-hidden={!sidebarOpen} className={`flex shrink-0 flex-col overflow-hidden border-border bg-sidebar transition-[width] duration-300 ${sidebarOpen ? "w-[min(360px,85vw)] border-r" : "w-0"}`}>
        <div className="flex h-full w-[min(360px,85vw)] flex-col">
        <header className="bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="Logo Kabupaten Magelang" className="h-10 w-auto shrink-0" />
              <div>
                <h1 className="text-base font-semibold leading-tight">WebGIS Eksekutif</h1>
                <p className="text-xs opacity-75">Distan dan Pangan Kab. Magelang</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button aria-label="Sembunyikan panel" title="Sembunyikan panel" onClick={() => setSidebarOpen(false)} className="rounded-md p-2 hover:bg-primary-foreground/15">
                <PanelLeftClose className="h-4 w-4" />
              </button>
              <button aria-label="Muat ulang data" onClick={() => sheet.refetch()} className="rounded-md p-2 hover:bg-primary-foreground/15">
                <RefreshCw className={`h-4 w-4 ${sheet.isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value.trim()) setPin(null); }} onKeyDown={(e) => { if (e.key === "Enter" && coord) setPin(coord); }} placeholder="Cari peta atau koordinat…"
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {q && <button aria-label="Hapus pencarian" onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
          </div>
          {coord && (
            <button onClick={() => setPin(coord)} className="mt-2 flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs font-medium text-primary hover:bg-primary/10">
              <MapPin className="h-4 w-4 shrink-0" /><span>Tuju lokasi koordinat <span className="font-normal text-muted-foreground tabular-nums">({coord[1].toFixed(5)}, {coord[0].toFixed(5)})</span></span>
            </button>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{rows.length} peta · {mapLayers.length} aktif</span>
            {Object.keys(active).length > 0 && <button onClick={() => setActive({})} className="font-medium text-primary hover:underline">Matikan semua</button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sheet.isLoading && <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Membaca Google Sheets…</div>}
          {sheet.error && <div className="m-2 flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{(sheet.error as Error).message}</div>}
          {!sheet.isLoading && !sheet.error && groups.length === 0 && <p className="p-4 text-sm text-muted-foreground">Tidak ada peta ditemukan.</p>}
          <DndContext sensors={sensors} collisionDetection={sameKindCollision} onDragEnd={onDragEnd}>
          <SortableContext items={groups.map(([kat]) => `kat:${kat}`)} strategy={verticalListSortingStrategy}>
          {groups.map(([kat, items]) => {
            const isCollapsed = collapsed[kat] ?? rows.length > 10;
            return (
            <SortableCategory key={`kat:${kat}`} id={`kat:${kat}`} name={kat}>
              {(catHandle) => <>
              <div className="flex items-center gap-1 px-1">
                {!q && catHandle}
                <button onClick={() => setCollapsed((c) => ({ ...c, [kat]: !isCollapsed }))}
                  className="flex min-w-0 flex-1 items-center justify-between px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{kat} <span className="font-normal">({items.length})</span></span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
              </div>
              {!isCollapsed && (
                <SortableContext items={items.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-0.5">
                  {items.map((r) => {
                    const a = active[r.id];
                    const fields = a?.status === "ready" ? propKeys(a.data) : [];
                    return (
                      <SortableLayer key={r.id} id={r.id} name={r.nama} className={`rounded-md border transition-colors ${a ? "border-primary/30 bg-card shadow-sm" : "border-transparent hover:bg-accent"} ${a?.hidden ? "opacity-60" : ""}`}>
                        {(handle) => <>
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          {handle}
                          <input type="checkbox" checked={!!a} onChange={() => toggle(r)} aria-label={`Tampilkan ${r.nama}`} className="h-4 w-4 shrink-0 cursor-pointer accent-primary" />
                          <button type="button" className="min-w-0 flex-1 text-left"
                            onClick={() => (a?.status === "ready" ? patch(r.id, { open: !a.open }) : toggle(r))}>
                            <div className="truncate text-[13px] font-medium leading-snug" title={r.nama}>{r.nama}</div>
                            {r.keterangan && <div className="truncate text-[11px] text-muted-foreground" title={r.keterangan}>{r.keterangan}</div>}
                            {a?.status === "ready" && (() => {
                              const tc = activeTierColors(r.id, a.data);
                              return tc ? (
                                <span aria-label={`Legenda ${r.nama}`} className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                                  {tc.map((c) => <span key={c.value} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: c.color }} />{c.value}</span>)}
                                </span>
                              ) : <span aria-label={`Legenda ${r.nama}`} className="mt-0.5 block h-1 w-6 rounded-sm" style={{ backgroundColor: colorFor(r) }} />;
                            })()}
                          </button>
                          {a?.status === "loading" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
                          {a?.status === "ready" && (
                            <>
                              <button aria-label={`Fokus ke layer ${r.nama}`} title="Fokus ke layer" onClick={() => setFocus({ id: r.id, n: Date.now() })}
                                className="shrink-0 text-muted-foreground hover:text-primary">
                                <Crosshair className="h-3.5 w-3.5" />
                              </button>
                              <Button variant="ghost" size="icon" aria-label={`Pengaturan warna dan label ${r.nama}`} title="Warna, label dan rekap" onClick={() => patch(r.id, { open: !a.open })}
                                className={`h-5 w-5 shrink-0 p-0 hover:text-primary ${a.open || a.label || manualColors[r.id] ? "text-primary" : "text-muted-foreground"}`}>
                                <Settings className="h-3.5 w-3.5" />
                              </Button>
                              <button aria-label={a.hidden ? "Tampilkan layer" : "Sembunyikan layer"} title={a.hidden ? "Tampilkan" : "Sembunyikan"}
                                onClick={() => patch(r.id, { hidden: !a.hidden })}
                                className="shrink-0 text-muted-foreground hover:text-primary">
                                {a.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </>
                          )}
                        </div>
                        {a?.status === "ready" && a.open && (
                          <div className="space-y-1.5 px-2 pb-2 pl-8">
                          <div className="flex items-center gap-2">
                            <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                              Warna
                              <input type="color" value={colorFor(r)} aria-label={`Warna ${r.nama}`} title="Pilih warna peta"
                                onChange={(e) => setManualColors((colors) => ({ ...colors, [r.id]: e.target.value }))}
                                className="layer-color-picker h-6 w-7 cursor-pointer rounded-md border border-input bg-background p-0.5 focus:outline-none focus:ring-1 focus:ring-ring" />
                            </label>
                            {manualColors[r.id] && <Button variant="ghost" size="icon" className="h-6 w-5 shrink-0 p-0 text-muted-foreground"
                              aria-label={`Kembalikan warna default ${r.nama}`} title="Warna default"
                              onClick={() => setManualColors(({ [r.id]: _, ...rest }) => rest)}><RotateCcw /></Button>}
                            <select value={a.label ?? ""} onChange={(e) => patch(r.id, { label: e.target.value || undefined })}
                              aria-label={`Label ${r.nama}`}
                              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                              <option value="">Tanpa label</option>
                              {fields.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          {(() => {
                            const info = tierInfoFor(r.id, a.data);
                            if (!info) return null;
                            const t = tiers[r.id];
                            const on = t?.enabled ?? true;
                            const options = tierFields(a.data);
                            return (
                              <div aria-label={`Pewarnaan bertingkat ${r.nama}`} className="space-y-1 rounded-md border border-border bg-background/60 p-1.5 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <Switch checked={on} onCheckedChange={(v) => setTier(r.id, { enabled: v })} aria-label={`Warna bertingkat ${r.nama}`} className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3" />
                                  <span className="shrink-0 font-medium">Warna bertingkat</span>
                                  {options.length > 1 ? (
                                    <select value={info.field} onChange={(e) => setTier(r.id, { field: e.target.value, colors: {} })} aria-label={`Kolom tingkatan ${r.nama}`}
                                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring">
                                      {options.map((o) => <option key={o.field} value={o.field}>{o.field}</option>)}
                                    </select>
                                  ) : <span className="min-w-0 truncate text-muted-foreground">({info.field})</span>}
                                </div>
                                {on && tierColors(info, t?.colors).map((c) => (
                                  <label key={c.value} className="flex items-center gap-1.5">
                                    <input type="color" value={c.color} aria-label={`Warna ${c.value}`} title={`Pilih warna ${c.value}`}
                                      onChange={(e) => setTier(r.id, { colors: { ...(tiers[r.id]?.colors ?? {}), [c.value]: e.target.value } })}
                                      className="layer-color-picker h-5 w-6 cursor-pointer rounded border border-input bg-background p-0.5" />
                                    <span className="min-w-0 truncate">{c.value}</span>
                                  </label>
                                ))}
                                {on && t && Object.keys(t.colors).length > 0 && (
                                  <button onClick={() => setTier(r.id, { colors: {} })} className="flex items-center gap-1 text-muted-foreground hover:text-primary"><RotateCcw className="h-3 w-3" />Warna tingkatan default</button>
                                )}
                              </div>
                            );
                          })()}
                          <div aria-label={`Rekap ${r.nama}`} className="border-t border-border pt-1.5 text-[11px]">
                            <div className="mb-1 flex items-start justify-between gap-2 text-muted-foreground"><span className="min-w-0 break-words font-medium">{regionScope}</span><span className="shrink-0 tabular-nums">{formatSummaryNumber(regionalViews[r.id]?.count ?? 0)} objek</span></div>
                            {regionalViews[r.id]?.summary.map((item) => <div key={`${item.label}-${item.unit}`} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 py-0.5"><span className="min-w-0 break-words text-muted-foreground">{item.label}:</span><span className="font-medium tabular-nums">{formatSummaryNumber(item.value)} {item.unit}</span></div>)}
                            {effectiveRegion.kecamatan && !regionalViews[r.id]?.hasRegion && <p className="mt-1 text-muted-foreground">Atribut Kecamatan tidak tersedia.</p>}
                          </div>
                          </div>
                        )}
                        {a?.status === "loading" && (
                          <div className="px-2 pb-1.5 pl-8">
                            <div className="flex items-center gap-1.5 text-[11px] text-primary">Mengunduh {a.loaded ? fmt(a.loaded) : ""}{a.total ? ` / ${fmt(a.total)}` : "…"}</div>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full bg-primary transition-all ${a.total ? "" : "w-1/3 animate-pulse"}`} style={a.total ? { width: `${(a.loaded / a.total) * 100}%` } : undefined} />
                            </div>
                          </div>
                        )}
                        {a?.status === "error" && <div className="flex gap-1.5 px-2 pb-1.5 pl-8 text-[11px] text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{a.error}</div>}
                        </>}
                      </SortableLayer>
                    );
                  })}
                </ul>
                </SortableContext>
              )}
              </>}
            </SortableCategory>
            );
          })}
          </SortableContext>
          </DndContext>
        </div>
        <footer className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Data diperbarui otomatis tiap 60 detik</footer>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1">
        <ClientOnly fallback={<div className="grid h-full place-items-center bg-muted"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
          <Suspense fallback={<div className="grid h-full place-items-center bg-muted"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <GisMap layers={mapLayers} focus={focus} regionZoomRequest={regionZoomRequest} satellite={satellite} regionKey={`${effectiveRegion.kecamatan}|${effectiveRegion.desa}`} regionBounds={regionBounds} pies={mapPies} filter={effectiveRegion} onDistrictPick={(kecamatan) => changeRegion({ kecamatan, desa: "" })} pin={pin} onPinClear={clearSearch} />
          </Suspense>
        </ClientOnly>

        <div className="absolute left-3 right-12 top-3 flex flex-wrap items-start gap-2">
        {!sidebarOpen && (
          <Button variant="outline" aria-label="Tampilkan panel peta" title="Tampilkan panel peta" onClick={() => setSidebarOpen(true)} className="relative h-10 w-10 shrink-0 bg-card p-0 shadow-md">
            <PanelLeftOpen className="h-4 w-4" />
            {mapLayers.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{mapLayers.length}</span>}
          </Button>
        )}
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-md">
          <Button size="sm" variant="ghost" onClick={() => setSatellite(false)} className={`h-10 gap-1.5 rounded-none px-3 text-xs ${!satellite ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "hover:bg-accent"}`}>
            <MapIcon className="h-3.5 w-3.5" />Peta
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSatellite("google")} className={`h-10 gap-1.5 rounded-none px-3 text-xs ${satellite === "google" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "hover:bg-accent"}`}>
            <Satellite className="h-3.5 w-3.5" />Google Satelit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSatellite("esri")} className={`h-10 gap-1.5 rounded-none px-3 text-xs ${satellite === "esri" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "hover:bg-accent"}`}>
            Esri
          </Button>
        </div>
        <RegionControls filter={effectiveRegion} options={regionChoices} onChange={changeRegion} />
        </div>

        <Button variant="outline" size="icon" aria-label="Buka grafik rangkuman" title="Grafik rangkuman" onClick={() => setChartOpen(true)}
          className="absolute right-2.5 top-[150px] h-[29px] w-[29px] rounded-md bg-card shadow-md"><BarChart3 className="h-4 w-4" /></Button>

        {mapPies.length > 0 && (
          <div aria-label="Legenda pupuk" className="absolute bottom-8 left-3 rounded-lg border border-border bg-card/95 px-3 py-2 text-[11px] shadow-md">
            <div className="mb-1 font-semibold">Jenis Pupuk · per {effectiveRegion.kecamatan ? "desa" : "kecamatan"}</div>
            <p className="mb-1 max-w-48 truncate text-muted-foreground" title={mapPies[0]?.nama}>{mapPies[0]?.nama}</p>
            {FERTILIZERS.map((f) => <div key={f.key} className="flex items-center gap-1.5 py-px"><span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />{f.label}</div>)}
          </div>
        )}

        <SummaryDrawer open={chartOpen} onClose={() => setChartOpen(false)} pies={pies} recaps={recaps} filter={effectiveRegion} scope={regionScope} onPick={pickRegion} />

        {loadingCount > 0 && (
          <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg">
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
