import { X } from "lucide-react";
import { Button } from "./ui/button";
import { FERTILIZERS, formatKg, type PieGroup } from "@/lib/fertilizer";
import { formatSummaryNumber, type RegionBars, type RegionFilter, type SummaryItem } from "@/lib/region-filter";

export type DrawerPie = { id: string; nama: string; groups: PieGroup[] };
export type DrawerRecap = { id: string; nama: string; color: string; count: number; summary: SummaryItem[]; chart: RegionBars };

export function SummaryDrawer({ open, onClose, pies, recaps, filter, scope, onPick }: {
  open: boolean; onClose: () => void; pies: DrawerPie[]; recaps: DrawerRecap[]; filter: RegionFilter; scope: string; onPick: (name: string) => void;
}) {
  return <aside aria-label="Panel grafik rangkuman" aria-hidden={!open}
    className={`absolute inset-y-0 right-0 z-20 flex w-[340px] max-w-full flex-col border-l border-border bg-card shadow-xl transition-transform duration-300 ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div><h2 className="text-sm font-semibold">Grafik Rangkuman</h2><p className="text-[11px] text-muted-foreground">{scope}</p></div>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Tutup panel grafik" onClick={onClose}><X /></Button>
    </div>
    <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
      {!pies.length && !recaps.length && <p className="text-muted-foreground">Centang peta di panel kiri untuk melihat grafik.</p>}
      {pies.map((p) => {
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
              <button type="button" onClick={() => onPick(g.name)} disabled={!!filter.desa} title={`${g.name}: ${formatKg(g.total)}`}
                className="w-full rounded px-1 py-0.5 text-left hover:bg-accent disabled:cursor-default">
                <div className="flex justify-between gap-2"><span className="truncate">{g.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{formatKg(g.total)}</span></div>
                <div className="mt-0.5 flex h-2 overflow-hidden rounded-sm bg-muted" style={{ width: `${Math.max(2, (g.total / max) * 100)}%` }}>
                  {FERTILIZERS.map((f) => g.values[f.key] ? <span key={f.key} style={{ width: `${(g.values[f.key] / g.total) * 100}%`, background: f.color }} /> : null)}
                </div>
              </button>
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
