import { RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { RegionFilter } from "@/lib/region-filter";

export function RegionControls({ filter, options, onChange }: { filter: RegionFilter; options: { kecamatan: string[]; desa: string[] }; onChange: (filter: RegionFilter) => void }) {
  return <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-card p-1 shadow-md" aria-label="Filter wilayah">
    <Select value={filter.kecamatan || "__all__"} onValueChange={(value) => onChange({ kecamatan: value === "__all__" ? "" : value, desa: "" })} disabled={!options.kecamatan.length}>
      <SelectTrigger aria-label="Pilih Kecamatan" className="h-8 w-[140px] min-w-0 border-0 px-2 text-xs shadow-none"><SelectValue placeholder="Pilih Kecamatan" /></SelectTrigger>
      <SelectContent><SelectItem value="__all__" className="text-xs">Pilih Kecamatan</SelectItem>{options.kecamatan.map((name) => <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>)}</SelectContent>
    </Select>
    <div className="h-5 border-l border-border" />
    <Select value={filter.desa || "__all__"} onValueChange={(value) => onChange({ ...filter, desa: value === "__all__" ? "" : value })} disabled={!filter.kecamatan || !options.desa.length}>
      <SelectTrigger aria-label="Pilih Desa" className="h-8 w-[130px] min-w-0 border-0 px-2 text-xs shadow-none"><SelectValue placeholder="Pilih Desa" /></SelectTrigger>
      <SelectContent><SelectItem value="__all__" className="text-xs">Pilih Desa</SelectItem>{options.desa.map((name) => <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>)}</SelectContent>
    </Select>
    <Button variant="ghost" size="icon" className="h-8 w-7 shrink-0 text-muted-foreground" aria-label="Reset filter wilayah" title="Se-Kabupaten" disabled={!filter.kecamatan} onClick={() => onChange({ kecamatan: "", desa: "" })}><RotateCcw /></Button>
  </div>;
}