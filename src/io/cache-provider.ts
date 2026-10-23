import {
	buildCacheControlDirectives,
	setConditionalHeaders,
} from "astro/cache/provider-utils";
import type { CacheProviderFactory } from "astro";

import { FEATURE_COOKIE, FEATURE_PARAM } from "../utilities/feature";

/**
 * astro marks prerender requests with an own `headers` getter that warns on access.
 * prerendered pages have no cookies anyway, so they're never checked
 */
const isPrerender = (request: Request): boolean =>
	Object.hasOwn(request, "headers");

const hasFeatureCookie = (request: Request): boolean =>
	!isPrerender(request) &&
	(request.headers.get("cookie") ?? "")
		.split(";")
		.some((pair) => pair.split("=", 1)[0]?.trim() === FEATURE_COOKIE);

/** feature flags change the output, and shared caches don't key on them */
const hasFeatures = (request: Request): boolean =>
	hasFeatureCookie(request) ||
	new URL(request.url).searchParams.has(FEATURE_PARAM);

/** emits cache headers for whatever cdn sits in front, stores nothing itself */
const cacheProvider: CacheProviderFactory = () => ({
	name: "cdn-headers",
	setHeaders: (options, request) => {
		const headers = new Headers();

		if (hasFeatures(request)) {
			headers.set("Cache-Control", "private, no-store");
			headers.set("CDN-Cache-Control", "no-store");
			return headers;
		}

		// browsers always revalidate, the cdn keeps its own ttl
		headers.set("Cache-Control", "no-cache");

		const directives =
			typeof options.maxAge !== "undefined" && options.maxAge > 0
				? buildCacheControlDirectives(options)
				: undefined;
		if (typeof directives === "undefined") {
			headers.set("CDN-Cache-Control", "no-store");
			return headers;
		}

		headers.set("CDN-Cache-Control", directives);
		// netlify keeps flagged and unflagged copies apart, cloudflare ignores this
		headers.set("Netlify-Vary", `cookie=${FEATURE_COOKIE}`);
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
