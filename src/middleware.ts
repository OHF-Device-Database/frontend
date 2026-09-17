import { NOINDEX } from "astro:env/server";
import { defineMiddleware, sequence } from "astro:middleware";

// middleware isn't shipped to clients, therefor perform side-effect import of caching setup here
import "./io/http-cache.ts";

import { assertIsLocale, setLocale } from "./paraglide/runtime.js";
import { paraglideMiddleware } from "./paraglide/server.js";
import { localeFromParam } from "./utilities/locale";

// Astro owns the routes `src/pages/[...locale]/`
// Paraglide determines the active locale and makes it available to `getLocale()`
const paraglide = defineMiddleware(async (context, next) => {
	const locale = localeFromParam(context.params.locale);

	// The rest param also matches segments that aren't locale prefixes
	// (`/en/about`, `/foo/about`, `/de/nonexistent`): render the 404 page.
	// `next("/404")` swaps the route without re-running this middleware, so
	// Paraglide still sees the original URL and picks the requested locale.
	if (typeof locale === "undefined") {
		return paraglideMiddleware(context.request, () => next("/404"));
	}

	if (context.isPrerendered) {
		// Build time: there is no request to detect the locale from, so store the
		// route's locale for `getLocale()` via the `globalVariable` strategy, as
		// Paraglide's SSG guide recommends. The value is process-global, which is safe because Astro renders
		// prerendered pages one at a time (`build.concurrency` defaults to 1).
		// Prerendered pages must only emit relative URLs: `getUrlOrigin()` has no
		// request to read from here, and one build serves preview and production.
		await setLocale(assertIsLocale(locale));

		return next();
	}

	// Request time: let Paraglide detect the locale from the URL
	return paraglideMiddleware(context.request, () => next());
});

const noindex = defineMiddleware(async (_, next) => {
	const response = await next();

	if (NOINDEX) {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
	}

	return response;
});

export const onRequest = sequence(paraglide, noindex);
