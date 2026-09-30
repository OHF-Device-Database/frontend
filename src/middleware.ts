import { NOINDEX } from "astro:env/server";
import { defineMiddleware, sequence } from "astro:middleware";

// middleware isn't shipped to clients, therefor perform side-effect import of caching setup here
import "./io/http-cache.ts";

import { paraglideMiddleware } from "./paraglide/server.js";
import { localeFromParam } from "./utilities/locale";

// Astro routes `src/pages/[...locale]/`, Paraglide resolves the locale for `getLocale()`
const paraglide = defineMiddleware((context, next) => {
	const locale = localeFromParam(context.params.locale);

	// `[...locale]` also matches non-locale segments (`/en/about`, `/foo/about`)
	if (typeof locale === "undefined") {
		return paraglideMiddleware(context.request, () => next("/404"));
	}

	// Paraglide reads the locale from the request URL, also for the request Astro
	// synthesises per prerendered page. That one warns when its headers are read
	// (Paraglide checks `Sec-Fetch-Dest`), so pass a bare request built from the URL.
	const request = context.isPrerendered
		? new Request(context.url)
		: context.request;

	return paraglideMiddleware(request, () => next());
});

const noindex = defineMiddleware(async (_, next) => {
	const response = await next();

	if (NOINDEX) {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
	}

	return response;
});

export const onRequest = sequence(paraglide, noindex);
