import { defineMiddleware } from "astro:middleware";

import { FEATURE_PARAM } from "../utilities/feature";

export const cache = defineMiddleware(async (context, next) => {
	if (context.isPrerendered) {
		return next();
	}

	// Capture incoming state before downstream middleware changes cookies.
	const personalized =
		context.request.headers.has("cookie") ||
		context.request.headers.has("authorization") ||
		context.url.searchParams.has(FEATURE_PARAM);

	const response = await next();

	if (
		personalized ||
		response.headers.has("set-cookie") ||
		context.cookies.headers().next().done !== true
	) {
		// Astro applies the provider's headers after middleware returns.
		context.cache.set(false);
		response.headers.set("Cache-Control", "private, no-store");
	}

	return response;
});
