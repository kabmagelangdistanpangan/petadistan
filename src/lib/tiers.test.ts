import { describe, expect, it } from "vitest";
import { tierFields, defaultTierColor } from "./tiers";
import { regionalView } from "./region-filter";

const f = (p: any) => ({ type: "Feature", properties: p, geometry: { type: "Point", coordinates: [110, -7.5] } });
const elev = { type: "FeatureCollection", features: [
  f({ KECAMATAN: "Grabag", DESA: "Losari", luas: 2, Ketinggian: "Dataran Tinggi" }),
  f({ KECAMATAN: "Grabag", DESA: "Losari", luas: 3, Ketinggian: "Dataran Rendah" }),
  f({ KECAMATAN: "Secang", DESA: "X", luas: 5, Ketinggian: "Dataran Sedang" }),
] };

describe("tiered layers", () => {
  it("detects Ketinggian ordered Tinggi, Sedang, Rendah and skips region fields", () => {
    const t = tierFields(elev);
    expect(t[0]?.field).toBe("Ketinggian");
    expect(t[0]?.values).toEqual(["Dataran Tinggi", "Dataran Sedang", "Dataran Rendah"]);
    expect(t.some((x) => x.field === "KECAMATAN")).toBe(false);
  });
  it("detects Kondisi Baik/Rusak with red for Rusak and green for Baik", () => {
    const geo = { type: "FeatureCollection", features: [f({ Kondisi: "Baik" }), f({ Kondisi: "Rusak" })] };
    expect(tierFields(geo)[0]?.values).toEqual(["Rusak", "Baik"]);
    expect(defaultTierColor("Rusak", 0)).toBe("#dc2626");
    expect(defaultTierColor("Baik", 1)).toBe("#16a34a");
  });
  it("sums Hektare per tier within the filtered kecamatan", () => {
    const v = regionalView(elev, { kecamatan: "Grabag", desa: "" }, "Ketinggian");
    expect(v.summary).toContainEqual({ label: "Dataran Tinggi", value: 2, unit: "Hektare" });
    expect(v.summary).toContainEqual({ label: "Total Luas", value: 5, unit: "Hektare" });
  });
});
