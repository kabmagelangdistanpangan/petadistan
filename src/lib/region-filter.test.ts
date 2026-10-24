import { describe, expect, it } from "vitest";
import { attributeNumber, regionalView, regionOptions, mergeRegionBounds } from "./region-filter";
import { normalizeMapJSON } from "./gis";

const feature = (properties: Record<string, unknown>, x = 110) => ({ type: "Feature", properties, geometry: { type: "Point", coordinates: [x, -7] } });
const irrigation = { type: "FeatureCollection", features: [
  feature({ Kecamatan: "A", Desa: "Satu", Kondisi: "Baik", Panjang: 12500 }),
  feature({ Kecamatan: "A", Desa: "Dua", Kondisi: "Rusak Berat", Panjang: 1450 }, 111),
  feature({ Kecamatan: "B", Desa: "Satu", Kondisi: "Baik", Panjang: 50 }, 112),
] };
describe("hierarchical region rules", () => {
  it("generates checked-layer options and dependent villages only", () => {
    expect(regionOptions([irrigation], "B")).toEqual({ kecamatan: ["A", "B"], desa: ["Satu"] });
    expect(regionOptions([])).toEqual({ kecamatan: [], desa: [] });
  });
  it("sums district defaults by condition in Meter", () => {
    expect(regionalView(irrigation, { kecamatan: "", desa: "" }).summary).toEqual([
      { label: "Baik", value: 12550, unit: "Meter" }, { label: "Rusak Berat", value: 1450, unit: "Meter" },
    ]);
  });
  it("narrows Kecamatan totals then Desa totals without including namesakes elsewhere", () => {
    expect(regionalView(irrigation, { kecamatan: "A", desa: "" }).count).toBe(2);
    const view = regionalView(irrigation, { kecamatan: "A", desa: "Satu" });
    expect(view.summary).toEqual([{ label: "Baik", value: 12500, unit: "Meter" }]);
    expect(view.bounds).toEqual([110, -7, 110, -7]);
    expect(irrigation.features).toHaveLength(3);
  });
  it("uses total length in Meter without Kondisi", () => {
    expect(regionalView(feature({ Panjang: 1450 }), { kecamatan: "", desa: "" }).summary).toEqual([{ label: "Total Panjang", value: 1450, unit: "Meter" }]);
  });
  it("sums Luas in Hektare and retains qualitative popup text", () => {
    const geo = feature({ Luas: 420, Keterangan: "Irigasi Rusak" });
    const view = regionalView(geo, { kecamatan: "", desa: "" });
    expect(view.summary).toEqual([{ label: "Total Luas", value: 420, unit: "Hektare" }]);
    expect(view.data.properties.Keterangan).toBe("Irigasi Rusak");
  });
  it("falls back to object counts and excludes unlocated features under region filter", () => {
    expect(regionalView(feature({}), { kecamatan: "", desa: "" }).summary).toEqual([{ label: "Total", value: 1, unit: "Objek/Blok" }]);
    expect(regionalView(feature({}), { kecamatan: "A", desa: "" }).count).toBe(0);
  });
  it("handles nulls, inconsistent casing and numeric strings safely", () => {
    const geo = { type: "FeatureCollection", features: [feature({ KECAMATAN: " a ", DESA: "Satu", PANJANG: "1.450,5" }), feature({ kecamatan: "A", desa: "Satu", panjang: "rusak" }), feature(null as unknown as Record<string, unknown>)] };
    expect(regionalView(geo, { kecamatan: "A", desa: "Satu" }).summary[0]?.value).toBe(1450.5);
    expect(attributeNumber(Infinity)).toBeNull();
    expect(attributeNumber(-1)).toBeNull();
  });
  it("supports normalized TopoJSON attributes and combines camera bounds", () => {
    const geo = normalizeMapJSON({ type: "Topology", arcs: [], objects: { area: { type: "Point", coordinates: [110, -7], properties: { Kecamatan: "A", Desa: "Satu", Luas: 420 } } } });
    const view = regionalView(geo, { kecamatan: "A", desa: "Satu" });
    expect(view.summary[0]?.value).toBe(420);
    expect(mergeRegionBounds([view.bounds, [111, -8, 112, -6], null])).toEqual([110, -8, 112, -6]);
  });
});