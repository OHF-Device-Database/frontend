import {
	buildCacheControlDirectives,
	setConditionalHeaders,
} from "astro/cache/provider-utils";
import type { CacheProviderFactory } from "astro";

/** emits cache headers for whatever cdn sits in front, stores nothing itself */
const cacheProvider: CacheProviderFactory = () => ({
	name: "cdn-headers",
	setHeaders: (options) => {
		const headers = new Headers();

		// the same ttl for browsers and the cdn, which adds `Age` on the way through
		const directives =
			typeof options.maxAge !== "undefined" && options.maxAge > 0
				? buildCacheControlDirectives(options)
				: undefined;
		if (typeof directives === "undefined") {
			headers.set("Cache-Control", "no-store");
			return headers;
		}

		headers.set("Cache-Control", `public, ${directives}`);
		// Cookie/auth requests must miss anonymous entries, middleware marks them no-store.
		headers.set("Netlify-Vary", "query, header=Cookie|Authorization");
		if (typeof options.tags !== "undefined" && options.tags.length > 0) {
			headers.set("Cache-Tag", options.tags.join(","));
		}
		setConditionalHeaders(headers, options);

		return headers;
	},
	// purging is left to the cdn
	invalidate: async () => {},
});

// eslint-disable-next-line no-restricted-exports -- astro loads cache providers through their default export
export default cacheProvider;
