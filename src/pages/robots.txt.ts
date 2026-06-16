import type { APIRoute } from "astro";
import { NOINDEX } from "astro:env/server";

// While the preview is no-indexed, disallow all crawling. For a production deploy
// (NOINDEX=false) allow everything.
const body = NOINDEX ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nDisallow:\n";

export const GET: APIRoute = () =>
    new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
