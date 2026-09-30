import { CSR_API_AUTHORITY } from "astro:env/server";
import type { APIRoute } from "astro";

// Server-rendered so prerendered pages still get the runtime value
export const prerender = false;

export const GET: APIRoute = () => {
	const headers = new Headers({
		"content-type": "text/javascript; charset=utf-8",
		// only changes on redeploy or restart
		"cache-control": "public, max-age=300",
	});

	return new Response(
		`window.__API_AUTHORITY__ = ${JSON.stringify(CSR_API_AUTHORITY)};\n`,
		{ headers },
	);
};
