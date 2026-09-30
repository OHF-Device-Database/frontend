import type { IoHeadersCaching } from "../io";

/**
 * Turns the API caching headers into `Astro.cache.set()` options. They only
 * drive Astro's in-process cache, the response has no `Cache-Control` header.
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
