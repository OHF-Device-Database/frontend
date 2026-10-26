import type { IoHeadersCaching } from "../io";

/**
 * Turns the API caching headers into `Astro.cache.set()` options, which
 * `src/io/cache-provider.ts` turns into response headers for the CDN.
 */
export const cachePolicy = (headers: IoHeadersCaching) => ({
	// exact optional property buffoonery
	...(typeof headers["cache-control"]?.maxAge !== "undefined"
		? { maxAge: headers["cache-control"]?.maxAge }
		: {}),
	...(typeof headers["last-modified"] !== "undefined"
		? { lastModified: headers["last-modified"] }
		: {}),
});
