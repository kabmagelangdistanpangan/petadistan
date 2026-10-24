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
