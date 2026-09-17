import { CSR_API_AUTHORITY } from "astro:env/server";
import type { APIRoute } from "astro";

// Server-rendered so the value is read from the runtime environment. Prerendered
// pages load this script instead of inlining the authority at build time, which
// keeps one build deployable to every environment.
export const prerender = false;

export const GET: APIRoute = (context) => {
	context.cache.set({ maxAge: 86400 });

	const headers = new Headers({
		"content-type": "text/javascript; charset=utf-8",
	});

	return new Response(
		`window.__API_AUTHORITY__ = ${JSON.stringify(CSR_API_AUTHORITY)};\n`,
		{ headers },
	);
};
