// Cache policy shared by the SSR routes. These numbers drive both the origin-side
// Astro cache (Astro.cache.set) and the CDN (Cloudflare) edge TTLs, so the two stay in sync.
export type CachePolicy = { maxAge: number; swr: number }

export const CACHE_POLICY = {
  browse: { maxAge: 60, swr: 300 },
  device: { maxAge: 300, swr: 3600 },
  // A missing device is cached only briefly so a newly-added one shows up quickly.
  deviceMissing: { maxAge: 30, swr: 60 },
  suggest: { maxAge: 30, swr: 120 },
} as const

// Emit a Cache-Control header tuned for a CDN sitting in front of the origin (Cloudflare):
//   - browsers revalidate immediately (max-age=0) so a user never trusts stale data blindly,
//     but that revalidation hits the warm edge cache and returns instantly;
//   - shared caches (Cloudflare) cache for s-maxage seconds — Cloudflare uses s-maxage for its
//     edge TTL once the response is eligible for caching;
//   - stale-while-revalidate lets the edge serve stale instantly while it refreshes in the background.
export function applyCdnCache(headers: Headers, { maxAge, swr }: CachePolicy): void {
  headers.set("Cache-Control", `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${swr}`)
}
