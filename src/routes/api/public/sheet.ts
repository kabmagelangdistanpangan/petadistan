import { createFileRoute } from "@tanstack/react-router";

// Public proxy: reads a shared Google Sheet as CSV through the gviz endpoint.
export const Route = createFileRoute("/api/public/sheet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const p = new URL(request.url).searchParams;
        const id = p.get("id") ?? "";
        const gid = p.get("gid") ?? "";
        if (!/^[A-Za-z0-9_-]{10,}$/.test(id) || !/^\d*$/.test(gid))
          return new Response("Parameter tidak valid", { status: 400 });
        const res = await fetch(
          `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}&_=${Date.now()}`,
        );
        const ct = res.headers.get("content-type") ?? "";
        if (!res.ok || ct.includes("text/html"))
          return new Response("Spreadsheet tidak dapat dibaca. Pastikan dibagikan ke 'Siapa saja yang memiliki link'.", { status: 502 });
        return new Response(await res.text(), {
          headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
