<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Google Sheets (gviz CSV) and Google Drive GeoJSON are fetched through public proxy routes under src/routes/api/public/ to avoid browser CORS; they only accept validated Google IDs to prevent open-proxy abuse.
- The map uses MapLibre (OpenFreeMap positron + Esri imagery raster toggled by visibility) and is lazy-loaded behind ClientOnly because it touches browser APIs.
- Normalize GeoJSON and TopoJSON downloads in src/lib/gis.ts, decoding every topology object with topojson-client before reprojection, so map rendering, labels, popups, and caching share one GeoJSON pipeline.
- Keep sidebar order separate from download state and derive bottom-to-top map ordering with src/lib/layer-order.ts; reconcile sheet refreshes without resetting manual positions, and render contiguous category sections so grouping never changes that order.
- Use dnd-kit sortable handles with pointer and keyboard sensors for sidebar reordering, committing order on drop so category regrouping does not interrupt dragging and checkbox/label controls remain independent.
- Resolve cartographic colors through src/lib/layer-colors.ts and keep session manual overrides separate from activation state; apply current paint to existing MapLibre layers so legend and geometry update without downloading again.
- Derive hierarchical region options, filtered geometry and adaptive summaries from a cached browser attribute index in src/lib/region-filter.ts; update existing map sources and fit filtered bounds without refetching or mutating downloaded data.
- Keep fertilizer primary-layer selection, marker sizing, and regional comparison calculations in the shared fertilizer module so map ordering and chart ratios remain consistent and testable; identify Realisasi by its layer name, never by activation order.
- Detect classified attributes and per-tier colors in src/lib/tiers.ts; the map applies them as MapLibre match expressions on existing layers, so toggling tiers never redownloads data.
