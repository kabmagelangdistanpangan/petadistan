import { describe, expect, it } from "vitest";
import { fertilizerGroups, isFertilizerLayer } from "./fertilizer";

const f = (p: Record<string, unknown>, x: number) => ({ type: "Feature", properties: p, geometry: { type: "Point", coordinates: [x, -7] } });
const geo = { type: "FeatureCollection", features: [
  f({ KECAMATAN: "A", DESA: "Satu", "Urea (kg)": 100, "NPK (kg)": 50, "Za (kg)": 0, "Organik (kg)": 10, "NPK formula (kg)": 5 }, 110),
  f({ KECAMATAN: "A", DESA: "Dua", "Urea (kg)": 200, "NPK (kg)": "1.000" }, 111),
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
    expect(g[0]!.values).toEqual({ urea: 300, npk: 1050, za: 0, organik: 10, npkformula: 5 });
    expect(g[0]!.center).toEqual([110.5, -7]);
  });
  it("aggregates per desa within the selected kecamatan", () => {
    expect(fertilizerGroups(geo, { kecamatan: "A", desa: "" }).map((x) => [x.name, x.total])).toEqual([["Dua", 1200], ["Satu", 165]]);
  });
});
