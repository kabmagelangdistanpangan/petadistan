import { createFileRoute } from "@tanstack/react-router";

// Public proxy: only fetches Google Drive files by ID (public share links) to avoid browser CORS.
export const Route = createFileRoute("/api/public/drive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return new Response("ID tidak valid", { status: 400 });
        const res = await fetch(
          `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
          { redirect: "follow" },
        );
        const ct = res.headers.get("content-type") ?? "";
        if (!res.ok || ct.includes("text/html")) {
          return new Response(
            "File Google Drive tidak dapat diunduh. Pastikan akses berbagi 'Siapa saja yang memiliki link'.",
            { status: 502 },
          );
        }
        const headers = new Headers({ "content-type": "application/json", "cache-control": "public, max-age=60" });
        const len = res.headers.get("content-length");
        if (len) headers.set("content-length", len);
        return new Response(res.body, { status: 200, headers });
      },
    },
  },
});
