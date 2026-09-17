import { NOINDEX } from "astro:env/server";
import { defineMiddleware, sequence } from "astro:middleware";

// middleware isn't shipped to clients, therefor perform side-effect import of caching setup here
import "./io/http-cache.ts";

import { paraglideMiddleware } from "./paraglide/server.js";
import { localeFromParam, localeStorage } from "./utilities/locale";

// Astro owns the routes `src/pages/[...locale]/`
// Paraglide determines the active locale and scopes it to the current
// render through AsyncLocalStorage, which is what `getLocale()` reads from
const paraglide = defineMiddleware((context, next) => {
	const locale = localeFromParam(context.params.locale);

	// The rest param also matches segments that aren't locale prefixes
	// (`/en/about`, `/foo/about`, `/de/nonexistent`): render the 404 page.
	// `next("/404")` swaps the route without re-running this middleware, so
	// Paraglide still sees the original URL and picks the requested locale.
	if (typeof locale === "undefined") {
		return paraglideMiddleware(context.request, () => next("/404"));
	}

	if (context.isPrerendered) {
		// Build time: there is no request to detect the locale from, so seed the
		// store from the route param instead (paraglideMiddleware would also try
		// to read request headers, which prerendered pages don't have).
		return localeStorage().run(
			{ locale, origin: context.url.origin, messageCalls: new Set() },
			() => next(),
		);
	}

	// Request time: let Paraglide detect the locale from the URL. The
	// delocalized request it offers is deliberately ignored, see above.
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
