import { afterEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { bbox, downloadGeoJSON, normalizeMapJSON, rowsFromCSV } from "./gis";

const topology = () => ({
  type: "Topology",
  transform: { scale: [0.01, 0.01], translate: [110, -8] },
  arcs: [[[0, 0], [10, 0], [0, 10], [-10, 0], [0, -10]]],
  objects: {
    wilayah: { type: "GeometryCollection", geometries: [
      { type: "Polygon", arcs: [[0]], id: "area-1", properties: { nama: "Wilayah A", luas: 12 } },
    ] },
    lokasi: { type: "Point", coordinates: [5, 5], properties: { nama: "Kantor" } },
  },
});

afterEach(() => vi.unstubAllGlobals());

describe("TopoJSON map support", () => {
  it("decodes all objects, transforms arcs and preserves popup/label properties", () => {
    const geo = normalizeMapJSON(topology());
    expect(geo.type).toBe("FeatureCollection");
    expect(geo.features).toHaveLength(2);
    expect(geo.features[0].id).toBe("area-1");
    expect(geo.features[0].properties).toEqual({ nama: "Wilayah A", luas: 12 });
    expect(geo.features[0].geometry.coordinates[0][2]).toEqual([110.1, -7.9]);
    expect(geo.features[1].geometry.coordinates).toEqual([110.05, -7.95]);
    expect(bbox(geo)).toEqual([110, -8, 110.1, -7.9]);
  });

  it("continues accepting existing GeoJSON", () => {
    const geo = { type: "Feature", properties: { nama: "Lama" }, geometry: { type: "Point", coordinates: [110, -7] } };
    expect(normalizeMapJSON(geo)).toBe(geo);
  });

  it("rejects empty and broken topologies with a clear error", () => {
    expect(() => normalizeMapJSON({ type: "Topology", objects: {}, arcs: [] })).toThrow(/TopoJSON/);
    expect(() => normalizeMapJSON({ type: "Topology" })).toThrow(/TopoJSON/);
    const broken = topology();
    broken.arcs = [];
    expect(() => normalizeMapJSON(broken)).toThrow(/TopoJSON/);
    expect(() => normalizeMapJSON({ type: "SomethingElse" })).toThrow(/GeoJSON atau TopoJSON/);
  });

  it("reprojects projected points inside nested geometry collections", () => {
    const geo = normalizeMapJSON({ type: "Topology", arcs: [], crs: { properties: { name: "EPSG:3857" } }, objects: {
      nested: { type: "GeometryCollection", geometries: [{ type: "GeometryCollection", geometries: [
        { type: "Point", coordinates: [12245143.987, -781182.214], properties: {} },
      ] }] },
    } });
    const bounds = bbox(geo);
    expect(bounds?.[0]).toBeCloseTo(110, 4);
    expect(bounds?.[1]).toBeCloseTo(-7, 4);
    expect(geo.crs).toBeUndefined();
  });

  it("accepts a TopoJSON column without changing existing sheet headers", () => {
    expect(rowsFromCSV("nama_peta,link_topojson,kategori\nBatas,https://example.com/batas.topojson,Wilayah")[0]?.link)
      .toBe("https://example.com/batas.topojson");
    expect(rowsFromCSV("nama peta,link json\nBatas,https://example.com/batas.json")).toHaveLength(1);
  });

  it.each([true, false])("normalizes downloads with a stream=%s and caches the converted data", async (streamed) => {
    vi.stubGlobal("Blob", NodeBlob);
    const body = JSON.stringify(topology());
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-length": String(body.length) }),
      body: streamed ? new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } }) : null,
      json: async () => JSON.parse(body),
    });
    vi.stubGlobal("fetch", fetchMock);
    const link = `https://drive.google.com/file/d/topojson_test_${streamed}/view`;
    const progress = vi.fn();
    const first = await downloadGeoJSON(link, progress);
    expect(first.features).toHaveLength(2);
    expect(await downloadGeoJSON(link, progress)).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/public/drive?id=topojson_test_${streamed}`);
    if (streamed) expect(progress).toHaveBeenCalledWith(body.length, body.length);
  });
});