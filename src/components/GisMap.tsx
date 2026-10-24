import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { bbox } from "@/lib/gis";
import { syncMapStack } from "@/lib/layer-order";
import { layerPaintColors } from "@/lib/layer-colors";

maplibregl.setWorkerUrl(workerUrl);

export type MapLayer = { id: string; data: any; color: string; nama: string; keterangan: string; visible?: boolean; label?: string | undefined; boundary?: boolean; manualColor?: boolean };

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export default function GisMap({
   layers, focus, satellite, regionKey, regionBounds,
}: { layers: MapLayer[]; focus: { id: string; n: number } | null; satellite: boolean; regionKey: string; regionBounds: [number, number, number, number] | null }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const added = useRef(new Set<string>());
  const sourceData = useRef(new Map<string, any>());
  const cameraRef = useRef({ regionKey, regionBounds, focus });
  cameraRef.current = { regionKey, regionBounds, focus };
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const satRef = useRef(satellite);
  satRef.current = satellite;

  const sync = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const layers = layersRef.current;
    const want = new Set(layers.map((l) => l.id));
    for (const id of [...added.current]) {
      if (!want.has(id)) {
        ["lbl", "fill", "line", "pt"].forEach((k) => map.getLayer(`lyr-${id}-${k}`) && map.removeLayer(`lyr-${id}-${k}`));
        map.getSource(`src-${id}`) && map.removeSource(`src-${id}`);
        added.current.delete(id);
        sourceData.current.delete(id);
      }
    }
    for (const l of layers) {
      if (added.current.has(l.id)) {
        if (sourceData.current.get(l.id) !== l.data) {
          const source = map.getSource(`src-${l.id}`) as maplibregl.GeoJSONSource | undefined;
          source?.setData(l.data);
          sourceData.current.set(l.id, l.data);
        }
        continue;
      }
      map.addSource(`src-${l.id}`, { type: "geojson", data: l.data });
      sourceData.current.set(l.id, l.data);
      map.addLayer({ id: `lyr-${l.id}-fill`, type: "fill", source: `src-${l.id}`,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: l.boundary
          ? { "fill-color": "#f5e6a2", "fill-opacity": 0.4 }
          : { "fill-color": l.color, "fill-opacity": 0.6 } });
      map.addLayer({ id: `lyr-${l.id}-line`, type: "line", source: `src-${l.id}`,
        filter: ["in", ["geometry-type"], ["literal", ["Polygon", "LineString"]]],
        paint: l.boundary
          ? { "line-color": "#1f2937", "line-width": 1.5, "line-dasharray": [3, 3], "line-opacity": 0.9 }
          : { "line-color": l.color, "line-width": ["case", ["==", ["geometry-type"], "LineString"], 3, 1.2], "line-opacity": 0.9 } });
      map.addLayer({ id: `lyr-${l.id}-pt`, type: "circle", source: `src-${l.id}`,
        filter: ["==", ["geometry-type"], "Point"],
        paint: l.boundary
          ? { "circle-color": "#f5e6a2", "circle-radius": 5, "circle-opacity": 0.7, "circle-stroke-color": "#1f2937", "circle-stroke-width": 1 }
          : { "circle-color": l.color, "circle-radius": 6, "circle-opacity": 0.85, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } });
      map.addLayer({ id: `lyr-${l.id}-lbl`, type: "symbol", source: `src-${l.id}`,
        layout: { "text-field": "", "text-font": ["Noto Sans Regular"], "text-size": 11, "symbol-placement": "point", "text-max-width": 8 },
        paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
      added.current.add(l.id);
    }
    syncMapStack(map, layers);
    for (const l of layers) {
      if (!added.current.has(l.id)) continue;
      const paint = layerPaintColors(l);
      map.setPaintProperty(`lyr-${l.id}-fill`, "fill-color", paint.fill);
      map.setPaintProperty(`lyr-${l.id}-fill`, "fill-opacity", paint.fillOpacity);
      map.setPaintProperty(`lyr-${l.id}-line`, "line-color", paint.stroke);
      map.setPaintProperty(`lyr-${l.id}-pt`, "circle-color", paint.fill);
      if (l.boundary) map.setPaintProperty(`lyr-${l.id}-pt`, "circle-stroke-color", paint.stroke);
      const vis = l.visible === false ? "none" : "visible";
      for (const k of ["fill", "line", "pt"])
        map.getLayer(`lyr-${l.id}-${k}`) && map.setLayoutProperty(`lyr-${l.id}-${k}`, "visibility", vis);
      const lbl = `lyr-${l.id}-lbl`;
      if (map.getLayer(lbl)) {
        map.setLayoutProperty(lbl, "visibility", l.visible === false || !l.label ? "none" : "visible");
        map.setLayoutProperty(lbl, "text-field", l.label ? ["to-string", ["coalesce", ["get", l.label], ""]] : "");
      }
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

  const fitCamera = (regional: boolean) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const camera = cameraRef.current;
    const layer = layersRef.current.find((item) => item.id === camera.focus?.id);
    const bounds = regional ? camera.regionBounds : layer ? bbox(layer.data) : null;
    if (!bounds) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(bounds, { padding: { top: 115, bottom: 45, left: 35, right: 45 }, maxZoom: 16, duration: reducedMotion ? 0 : 700 });
  };

  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({
      container: el.current,
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
      fitCamera(cameraRef.current.regionKey !== "|");
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
    return () => { readyRef.current = false; added.current.clear(); sourceData.current.clear(); mapRef.current = null; map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(sync);
  useEffect(applyBasemap, [satellite]);

  useEffect(() => {
    fitCamera(regionKey !== "|");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const boundsKey = regionBounds?.join(",") ?? "";
  useEffect(() => { fitCamera(true); }, [regionKey, boundsKey]);

  return <div ref={el} className="h-full w-full" />;
}
