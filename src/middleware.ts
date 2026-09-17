import { NOINDEX } from "astro:env/server";
import { defineMiddleware, sequence } from "astro:middleware";

// middleware isn't shipped to clients, therefor perform side-effect import of caching setup here
import "./io/http-cache.ts";

import { paraglideMiddleware } from "./paraglide/server.js";

const paraglide = defineMiddleware((context, next) =>
	paraglideMiddleware(context.request, ({ request }) =>
		request.url !== context.request.url ? next(request) : next(),
	),
);

const noindex = defineMiddleware(async (_, next) => {
	const response = await next();

	if (NOINDEX) {
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
	}

	return response;
});

export const onRequest = sequence(paraglide, noindex);
