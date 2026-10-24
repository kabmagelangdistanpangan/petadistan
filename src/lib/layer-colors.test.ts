import { describe, expect, it } from "vitest";
import { defaultLayerColor, layerPaintColors, resolveLayerColor } from "./layer-colors";

describe("cartographic color priority", () => {
  it("uses blue shades for Primer, Sekunder and Tersier", () => {
    expect(["Primer", "Sekunder", "Tersier"].map((n) => defaultLayerColor(`Saluran ${n}`)))
      .toEqual(["#0077cc", "#0091ff", "#38bdf8"]);
  });
  it("uses red/orange shades for Nasional, Provinsi and Kabupaten", () => {
    expect(["Nasional", "Provinsi", "Kabupaten"].map((n) => defaultLayerColor(`Jalan ${n}`)))
      .toEqual(["#e11d48", "#f97316", "#fb923c"]);
  });
  it("uses pastel yellow for Administrasi even when Kabupaten occurs in the name", () => {
    expect(defaultLayerColor("Peta Batas Administrasi Kabupaten Magelang")).toBe("#f5e6a2");
  });
  it("uses green shades for LP2B and Padi", () => {
    expect(defaultLayerColor("LP2B")).toBe("#10b981");
    expect(defaultLayerColor("Lahan Padi")).toBe("#22c55e");
  });
  it.each(["Peta Batas Administrasi", "Primer", "Nasional", "LP2B"])("manual color wins for %s", (name) => {
    expect(resolveLayerColor(name, 0, "#cc00aa")).toBe("#cc00aa");
  });
  it("changes both boundary fill and stroke when manually overridden, keeping opacity 0.4", () => {
    expect(layerPaintColors({ color: "#cc00aa", boundary: true, manualColor: true }))
      .toEqual({ fill: "#cc00aa", stroke: "#cc00aa", fillOpacity: 0.4 });
  });
  it("retains dark boundary stroke by default", () => {
    expect(layerPaintColors({ color: "#f5e6a2", boundary: true }).stroke).toBe("#1f2937");
  });
  it("keeps data fill opacity at 0.6 with matching fill and stroke", () => {
    expect(layerPaintColors({ color: "#0091ff", manualColor: true }))
      .toEqual({ fill: "#0091ff", stroke: "#0091ff", fillOpacity: 0.6 });
  });
});