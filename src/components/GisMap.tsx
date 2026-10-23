import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { bbox } from "@/lib/gis";

maplibregl.setWorkerUrl(workerUrl);

export type MapLayer = { id: string; data: any; color: string; nama: string; keterangan: string; visible?: boolean };

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function GisMap({
  layers, focus, satellite,
}: { layers: MapLayer[]; focus: { id: string; n: number } | null; satellite: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const added = useRef(new Set<string>());
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const satRef = useRef(satellite);
  satRef.current = satellite;

  const sync = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const want = new Set(layers.map((l) => l.id));
    for (const id of [...added.current]) {
      if (!want.has(id)) {
        ["fill", "line", "pt"].forEach((k) => map.getLayer(`lyr-${id}-${k}`) && map.removeLayer(`lyr-${id}-${k}`));
        map.getSource(`src-${id}`) && map.removeSource(`src-${id}`);
        added.current.delete(id);
      }
    }
    for (const l of layers) {
      if (added.current.has(l.id)) continue;
      map.addSource(`src-${l.id}`, { type: "geojson", data: l.data });
      map.addLayer({ id: `lyr-${l.id}-fill`, type: "fill", source: `src-${l.id}`,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": l.color, "fill-opacity": 0.6 } });
      map.addLayer({ id: `lyr-${l.id}-line`, type: "line", source: `src-${l.id}`,
        filter: ["in", ["geometry-type"], ["literal", ["Polygon", "LineString"]]],
        paint: { "line-color": l.color, "line-width": ["case", ["==", ["geometry-type"], "LineString"], 3, 1.2], "line-opacity": 0.9 } });
      map.addLayer({ id: `lyr-${l.id}-pt`, type: "circle", source: `src-${l.id}`,
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-color": l.color, "circle-radius": 6, "circle-opacity": 0.85, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } });
      added.current.add(l.id);
    }
    for (const l of layers) {
      if (!added.current.has(l.id)) continue;
      const vis = l.visible === false ? "none" : "visible";
      for (const k of ["fill", "line", "pt"])
        map.getLayer(`lyr-${l.id}-${k}`) && map.setLayoutProperty(`lyr-${l.id}-${k}`, "visibility", vis);
    }
  };

  const applyBasemap = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    for (const ly of map.getStyle().layers) {
      if (ly.id.startsWith("lyr-")) continue;
      const vis = ly.id === "satellite" ? satRef.current : !satRef.current || ly.type === "symbol";
      map.setLayoutProperty(ly.id, "visibility", vis ? "visible" : "none");
    }
  };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current!,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [110.22, -7.48],
      zoom: 10,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({}), "bottom-right");
    map.on("load", () => {
      map.addSource("esri", {
        type: "raster", tileSize: 256,
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        attribution: "Imagery © Esri",
      });
      const first = map.getStyle().layers[0]?.id;
      map.addLayer({ id: "satellite", type: "raster", source: "esri", layout: { visibility: "none" } }, first);
      readyRef.current = true;
      applyBasemap();
      sync();
    });
    map.on("click", (e) => {
      const ids = [...added.current].flatMap((id) => [`lyr-${id}-pt`, `lyr-${id}-line`, `lyr-${id}-fill`]);
      const f = map.queryRenderedFeatures(e.point, { layers: ids })[0];
      if (!f) return;
      const lid = f.layer.id.split("-")[1];
      const meta = layersRef.current.find((l) => l.id === lid);
      const props = Object.entries(f.properties ?? {})
        .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</td></tr>`).join("");
      new maplibregl.Popup({ maxWidth: "340px", className: "gis-popup" })
        .setLngLat(e.lngLat)
        .setHTML(`<div class="gis-pop"><div class="gis-pop-head"><span style="background:${meta?.color}"></span>${esc(meta?.nama)}</div>${
          meta?.keterangan ? `<p>${esc(meta.keterangan)}</p>` : ""}${props ? `<div class="gis-pop-tbl"><table>${props}</table></div>` : ""}</div>`)
        .addTo(map);
    });
    map.on("mousemove", (e) => {
      const ids = [...added.current].flatMap((id) => [`lyr-${id}-pt`, `lyr-${id}-line`, `lyr-${id}-fill`]);
      map.getCanvas().style.cursor = ids.length && map.queryRenderedFeatures(e.point, { layers: ids }).length ? "pointer" : "";
    });
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(sync);
  useEffect(applyBasemap, [satellite]);

  useEffect(() => {
    const map = mapRef.current;
    const l = layers.find((x) => x.id === focus?.id);
    if (!map || !l) return;
    const b = bbox(l.data);
    if (b) map.fitBounds(b, { padding: 60, maxZoom: 16, duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return <div ref={el} className="h-full w-full" />;
}
