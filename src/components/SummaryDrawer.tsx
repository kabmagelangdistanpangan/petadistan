import { X } from "lucide-react";
import { Button } from "./ui/button";
import { FERTILIZERS, formatKg, fertilizerComparison, type PieGroup } from "@/lib/fertilizer";
import { formatSummaryNumber, type RegionBars, type RegionFilter, type SummaryItem } from "@/lib/region-filter";

export type DrawerPie = { id: string; nama: string; groups: PieGroup[] };
export type DrawerRecap = { id: string; nama: string; color: string; count: number; summary: SummaryItem[]; chart: RegionBars };

export function SummaryDrawer({ open, onClose, pies, recaps, filter, scope, onPick }: {
  open: boolean; onClose: () => void; pies: DrawerPie[]; recaps: DrawerRecap[]; filter: RegionFilter; scope: string; onPick: (name: string) => void;
}) {
  const comparison = pies.length > 1 ? fertilizerComparison(pies) : null;
  const seriesClass = (index: number) => index % 2 === 0 ? "bg-primary" : "bg-chart-1";
  const percentLabel = (value: number | null) => value === null ? "— (RDKK 0)" : `${formatSummaryNumber(value)}%`;
  return <aside aria-label="Panel grafik rangkuman" aria-hidden={!open}
    className={`absolute inset-y-0 right-0 z-20 flex w-[340px] max-w-full flex-col border-l border-border bg-card shadow-xl transition-transform duration-300 ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div><h2 className="text-sm font-semibold">Grafik Rangkuman</h2><p className="text-[11px] text-muted-foreground">{scope}</p></div>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Tutup panel grafik" onClick={onClose}><X /></Button>
    </div>
    <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
      {!pies.length && !recaps.length && <p className="text-muted-foreground">Centang peta di panel kiri untuk melihat grafik.</p>}
      {comparison && <section aria-label="Perbandingan pupuk" className="space-y-3">
        <h3 className="font-semibold">Perbandingan Pupuk</h3>
        <div className="space-y-1 border-b border-border pb-2">
          {pies.map((p, index) => <div key={p.id} className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5"><span className={`h-2 w-2 shrink-0 rounded-sm ${seriesClass(index)}`} /><span className="break-words">{p.nama}</span></span>
            <span className="shrink-0 tabular-nums">{formatKg(comparison.totals[p.id] ?? 0)}</span>
          </div>)}
          {comparison.percentages.map((p) => <div key={p.id} className="flex flex-wrap justify-between gap-1 pt-1 font-medium"><span>Serapan {p.nama}</span><span className="tabular-nums">{percentLabel(p.percent)}</span></div>)}
        </div>
        <p className="text-[11px] text-muted-foreground">Total pupuk per {filter.kecamatan ? "desa" : "kecamatan"}</p>
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground"><span>0</span><span>{formatKg(comparison.max / 2)}</span><span>{formatKg(comparison.max)}</span></div>
        <ul className="space-y-2">{comparison.bars.map((region) => <li key={region.name}>
          <Button variant="ghost" onClick={() => onPick(region.name)} disabled={!!filter.desa || region.name === "Tanpa nama"} aria-label={`Filter wilayah ${region.name}`}
            className="block h-auto w-full whitespace-normal px-1 py-1 text-left text-xs font-normal">
            <div className="mb-1 font-medium">{region.name}</div>
            <div className="space-y-1">{pies.map((p, index) => <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-2" title={`${p.nama}: ${formatKg(region.totals[p.id] ?? 0)}`}>
              <div className="h-2 overflow-hidden rounded-sm bg-muted"><div className={`h-full ${seriesClass(index)}`} style={{ width: `${((region.totals[p.id] ?? 0) / comparison.max) * 100}%` }} /></div>
              <span className="text-right text-[11px] tabular-nums text-muted-foreground">{formatKg(region.totals[p.id] ?? 0)}</span>
            </div>)}</div>
            {region.percentages.map((p) => <div key={p.id} className="mt-1 flex flex-wrap justify-between gap-1 text-[11px]"><span>Serapan{comparison.percentages.length > 1 ? ` ${p.nama}` : ""}</span><span className="font-medium tabular-nums">{percentLabel(p.percent)}</span></div>)}
          </Button>
        </li>)}</ul>
      </section>}
      {!comparison && pies.map((p) => {
        const totals = Object.fromEntries(FERTILIZERS.map((f) => [f.key, p.groups.reduce((s, g) => s + g.values[f.key], 0)])) as Record<string, number>;
        const grand = Object.values(totals).reduce((s, v) => s + v, 0);
        const max = Math.max(1, ...p.groups.map((g) => g.total));
        const types = FERTILIZERS.filter((f) => totals[f.key]).sort((a, b) => (totals[b.key] ?? 0) - (totals[a.key] ?? 0));
        return <section key={p.id} className="space-y-2">
          <h3 className="font-semibold">{p.nama}</h3>
          <div className="rounded-md bg-muted/60 p-2">
            <div className="flex justify-between font-medium"><span>Total</span><span className="tabular-nums">{formatKg(grand)}</span></div>
            {types.map((f) => <div key={f.key} className="flex items-center justify-between py-0.5"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: f.color }} />{f.label}</span><span className="tabular-nums">{formatKg(totals[f.key] ?? 0)}</span></div>)}
          </div>
          <p className="text-[11px] text-muted-foreground">Per {filter.kecamatan ? "desa" : "kecamatan"}{filter.desa ? "" : " · klik batang untuk memfilter"}</p>
          <ul className="space-y-1">
            {p.groups.map((g) => <li key={g.name}>
              <Button variant="ghost" onClick={() => onPick(g.name)} disabled={!!filter.desa || g.name === "Tanpa nama"} title={`${g.name}: ${formatKg(g.total)}`}
                className="block h-auto w-full px-1 py-0.5 text-left text-xs font-normal disabled:cursor-default">
                <div className="flex justify-between gap-2"><span className="truncate">{g.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{formatKg(g.total)}</span></div>
                <div className="mt-0.5 flex h-2 overflow-hidden rounded-sm bg-muted" style={{ width: `${Math.max(2, (g.total / max) * 100)}%` }}>
                  {FERTILIZERS.map((f) => g.values[f.key] ? <span key={f.key} style={{ width: `${(g.values[f.key] / g.total) * 100}%`, background: f.color }} /> : null)}
                </div>
              </Button>
            </li>)}
          </ul>
        </section>;
      })}
      {recaps.length > 0 && <section className="space-y-2">
        <h3 className="font-semibold">Rekapitulasi Layer Aktif</h3>
        {recaps.map((r) => <div key={r.id} className="rounded-md border border-border p-2">
          <div className="mb-1 flex items-center justify-between gap-2 font-medium"><span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: r.color }} /><span className="truncate">{r.nama}</span></span><span className="shrink-0 tabular-nums text-muted-foreground">{formatSummaryNumber(r.count)} objek</span></div>
          {r.summary.map((s) => <div key={s.label} className="flex justify-between gap-2 py-0.5"><span className="text-muted-foreground">{s.label}</span><span className="tabular-nums">{formatSummaryNumber(s.value)} {s.unit}</span></div>)}
          {(() => { const max = Math.max(1, ...r.chart.bars.map((b) => b.value)); return <>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{r.chart.metric} ({r.chart.unit}) per {filter.kecamatan ? "desa" : "kecamatan"}</p>
            <ul className="mt-1 space-y-1">{r.chart.bars.map((b) => <li key={b.name}>
              <button type="button" onClick={() => onPick(b.name)} disabled={!!filter.desa || b.name === "Tanpa nama"} title={`${b.name}: ${formatSummaryNumber(b.value)} ${r.chart.unit}`}
                className="w-full rounded px-1 py-0.5 text-left hover:bg-accent disabled:cursor-default">
                <div className="flex justify-between gap-2"><span className="truncate">{b.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{formatSummaryNumber(b.value)}</span></div>
                <div className="mt-0.5 h-2 rounded-sm" style={{ width: `${Math.max(2, (b.value / max) * 100)}%`, background: r.color }} />
              </button></li>)}</ul></>; })()}
        </div>)}
      </section>}
    </div>
  </aside>;
}
