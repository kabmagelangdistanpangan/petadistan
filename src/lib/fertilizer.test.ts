import { describe, expect, it } from "vitest";
import { fertilizerGroups, isFertilizerLayer, fertilizerComparison, absorptionPercent, primaryFertilizerPies, pieDiameter, pieClickDistrict } from "./fertilizer";

const f = (p: Record<string, unknown>, x: number) => ({ type: "Feature", properties: p, geometry: { type: "Point", coordinates: [x, -7] } });
const geo = { type: "FeatureCollection", features: [
  f({ KECAMATAN: "A", DESA: "Satu", "Urea (kg)": 100, "NPK (kg)": 50, "Za (kg)": 0, "Organik (kg)": 10, "NPK formula (kg)": 5 }, 110),
  f({ KECAMATAN: "A", DESA: "Dua", "Urea (kg)": 200, "NPK (kg)": 1000 }, 111),
  f({ KECAMATAN: "B", DESA: "Satu", "Urea (kg)": 1 }, 112),
] };

describe("fertilizer pies", () => {
  it("detects Pupuk category and RDKK layers", () => {
    expect(isFertilizerLayer("Pupuk", "Sebaran RDKK")).toBe(true);
    expect(isFertilizerLayer("Lain", "Realisasi RDKK")).toBe(true);
    expect(isFertilizerLayer("Irigasi", "Saluran")).toBe(false);
  });
  it("aggregates per kecamatan district-wide, keeping NPK and NPK formula apart", () => {
    const g = fertilizerGroups(geo, { kecamatan: "", desa: "" });
    expect(g.map((x) => x.name)).toEqual(["A", "B"]);
    expect(g[0]?.values).toEqual({ urea: 300, npk: 1050, za: 0, organik: 10, npkformula: 5 });
    expect(g[0]?.center).toEqual([110.5, -7]);
  });
  it("aggregates per desa within the selected kecamatan", () => {
    expect(fertilizerGroups(geo, { kecamatan: "A", desa: "" }).map((x) => [x.name, x.total])).toEqual([["Dua", 1200], ["Satu", 165]]);
  });
});

describe("fertilizer drill-down and comparison", () => {
  const allocation = { id: "a", nama: "Sebaran RDKK", groups: fertilizerGroups(geo, { kecamatan: "", desa: "" }) };
  const real = { id: "r", nama: "Realisasi RDKK", groups: fertilizerGroups({ type: "FeatureCollection", features: [f({ KECAMATAN: " a ", DESA: "Satu", "Urea (kg)": 273 }, 110), f({ KECAMATAN: "C", DESA: "Baru", "Urea (kg)": 100 }, 112)] }, { kecamatan: "", desa: "" }) };
  it("clicking a district selects it but a village click only opens details", () => {
    expect(pieClickDistrict({ kecamatan: "", desa: "" }, "Grabag")).toBe("Grabag");
    expect(pieClickDistrict({ kecamatan: "Grabag", desa: "" }, "Satu")).toBeNull();
    expect(pieClickDistrict({ kecamatan: "", desa: "" }, "Tanpa nama")).toBeNull();
  });
  it("reduces largest and smallest pie diameters by 15–20 percent", () => {
    expect(pieDiameter(100, 100)).toBe(43);
    expect(pieDiameter(0, 100)).toBe(18);
  });
  it("shows just the frontmost visible fertilizer series in either stacking mode", () => {
    expect(primaryFertilizerPies([allocation, real], [{ id: "r" }, { id: "a" }]).map((p) => p.id)).toEqual(["a"]);
    expect(primaryFertilizerPies([allocation, real], [{ id: "a" }, { id: "r" }]).map((p) => p.id)).toEqual(["r"]);
    expect(primaryFertilizerPies([allocation, { ...real, hidden: true }], [{ id: "a" }, { id: "r", visible: false }]).map((p) => p.id)).toEqual(["a"]);
  });
  it("compares normalized regions, missing values and Realisasi/RDKK regardless of series order", () => {
    const result = fertilizerComparison([real, allocation]);
    expect(result.bars.find((b) => b.name.trim().toLowerCase() === "a")?.percentages[0]?.percent).toBe(20);
    expect(result.bars.find((b) => b.name === "B")?.percentages[0]?.percent).toBe(0);
    expect(result.bars.find((b) => b.name === "C")?.percentages[0]?.percent).toBeNull();
    expect(result.totals).toEqual({ r: 373, a: 1366 });
    expect(result.percentages[0]?.percent).toBeCloseTo(373 / 1366 * 100);
  });
  it("allows serapan over 100 percent and avoids dividing by zero", () => {
    expect(absorptionPercent(120, 100)).toBe(120);
    expect(absorptionPercent(0, 0)).toBeNull();
  });
  it("compares villages within the chosen kecamatan", () => {
    const series = [allocation, real].map((s) => ({ ...s, groups: fertilizerGroups(s.id === "a" ? geo : { type: "FeatureCollection", features: [f({ KECAMATAN: "A", DESA: "Satu", "Urea (kg)": 33 }, 110)] }, { kecamatan: "A", desa: "" }) }));
    expect(fertilizerComparison(series).bars.map((b) => [b.name, b.percentages[0]?.percent])).toEqual([["Dua", 0], ["Satu", 20]]);
  });
});
