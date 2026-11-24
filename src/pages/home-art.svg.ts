import type { APIRoute } from "astro";

import { homeArtSymbol } from "../utilities/home-art";

// One file with every card drawing as a symbol. The landing page fetches it
// once it is running, so the drawings stay out of the page's own HTML.
export const prerender = true;

const files = import.meta.glob<string>(
	"../assets/illustrations/categories/*/*-animated.svg",
	{ query: "?raw", import: "default", eager: true },
);

const NAME = /\/(?<name>[^/]+)-animated\.svg$/;

export const GET: APIRoute = () => {
	const symbols = Object.entries(files)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([path, svg]) => {
			const name = NAME.exec(path)?.groups?.["name"];
			if (name === undefined) {
				throw new Error(`unexpected drawing path "${path}"`);
			}
			return homeArtSymbol(name, svg);
		});

	return new Response(
		`<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>\n`,
		{ headers: { "content-type": "image/svg+xml; charset=utf-8" } },
	);
};
