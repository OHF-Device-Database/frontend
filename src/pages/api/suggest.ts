import type { APIRoute } from "astro"
import { fetchDeviceResults, fetchManufacturers } from "../../lib/api"
import { EMPTY_BROWSE_FILTERS } from "../../lib/browse-filters"
import { DEVICE_CATEGORIES } from "../../lib/categories"
import { pickFacetSuggestions, type SuggestDevice, type Suggestions } from "../../lib/search"

export const prerender = false

const DEVICE_SUGGEST_LIMIT = 5
const FETCH_SIZE = 10

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  })

export const GET: APIRoute = async ({ url, cache }) => {
  const q = (url.searchParams.get("q") ?? "").trim()

  if (!q) {
    return json({})
  }

  // Cache identical queries briefly; the in-process memo in api-client dedupes upstream.
  cache.set({ maxAge: 30, swr: 120, tags: ["devices"] })

  const [results, manufacturers] = await Promise.all([
    fetchDeviceResults({ ...EMPTY_BROWSE_FILTERS, q }, 0, FETCH_SIZE),
    fetchManufacturers(),
  ])

  const devices: SuggestDevice[] = results.devices.slice(0, DEVICE_SUGGEST_LIMIT).map((d) => ({
    id: d.id,
    name: d.name,
    manufacturer: d.manufacturer,
    category: d.category,
  }))
  const facets = pickFacetSuggestions(q, manufacturers, DEVICE_CATEGORIES)

  const out: Suggestions = {}
  if (facets.categories.length) {
    out.categories = facets.categories
  }
  if (devices.length) {
    out.devices = devices
    out.deviceMore = results.total > DEVICE_SUGGEST_LIMIT ? results.total : 0
  }
  if (facets.manufacturers.length) {
    out.manufacturers = facets.manufacturers
  }

  return json(out)
}
