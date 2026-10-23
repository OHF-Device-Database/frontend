import memoryProvider from "astro/cache/memory";
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

/** memory cache that skips requests carrying feature flags, since it keys on the url only */
const featureCacheProvider: CacheProviderFactory = (config) => {
	const memory = memoryProvider(config);

	return {
		...memory,
		name: "feature-memory",
		onRequest: async (context, next) => {
			if (
				typeof memory.onRequest === "undefined" ||
				hasFeatureCookie(context.request) ||
				context.url.searchParams.has(FEATURE_PARAM)
			) {
				return next();
			}

			return memory.onRequest(context, next);
		},
	};
};

// eslint-disable-next-line no-restricted-exports -- astro loads cache providers through their default export
export default featureCacheProvider;
