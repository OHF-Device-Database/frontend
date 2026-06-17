import { defineMiddleware } from "astro:middleware";
import { NOINDEX } from "astro:env/server";

// Keep the preview edition out of search engines. The header is the strongest signal
// (Google honors `X-Robots-Tag`) and complements the <meta name="robots"> tag in Layout.
// Set here in middleware because it runs outside Astro's response-cache normalization, so the
// header survives on both cache hits and misses.
export const onRequest = defineMiddleware(async (_context, next) => {
    const response = await next();
    if (NOINDEX) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
});
