import { DEVICE_CATEGORIES } from "./categories"
import type { Category } from "./device"

export interface QuickFilter {
  id: string
  title: string
  icon: string
  breadcrumb: string
  filters: { category?: string[]; manufacturer?: string[]; localOnly?: boolean }
}

export const QUICK_FILTERS: QuickFilter[] = [
  {
    id: "sensors-local",
    title: "Sensors with local connection",
    icon: "sensors",
    breadcrumb: "Sensors · Occupancy and motion · Local connection",
    filters: { category: ["sensors", "presence"], localOnly: true },
  },
  {
    id: "lighting-local",
    title: "Lighting with local connection",
    icon: "lighting",
    breadcrumb: "Lighting · Local connection",
    filters: { category: ["lighting"], localOnly: true },
  },
  {
    id: "cameras-local",
    title: "Cameras with local connection",
    icon: "cameras",
    breadcrumb: "Cameras and NVRs · Local connection",
    filters: { category: ["cameras"], localOnly: true },
  },
  {
    id: "switches-local",
    title: "Switches with local connection",
    icon: "controls",
    breadcrumb: "Buttons, switches and controls · Local connection",
    filters: { category: ["controls"], localOnly: true },
  },
  {
    id: "hubs",
    title: "Hubs and bridges",
    icon: "hubs",
    breadcrumb: "Hubs, routers and bridges",
    filters: { category: ["hubs"] },
  },
  {
    id: "energy",
    title: "Energy monitoring",
    icon: "power",
    breadcrumb: "Power and energy",
    filters: { category: ["power"] },
  },
]

export interface SuggestDevice {
  id: string
  name: string
  manufacturer: string
  category: string
}

export interface Suggestions {
  categories?: Category[]
  devices?: SuggestDevice[]
  deviceMore?: number
  manufacturers?: string[]
}

export const FACET_SUGGEST_LIMIT = 5

export function pickFacetSuggestions(
  q: string,
  manufacturers: string[],
  categories: Category[] = DEVICE_CATEGORIES,
): { categories: Category[]; manufacturers: string[] } {
  const term = q.trim().toLowerCase()

  if (!term) {
    return { categories: [], manufacturers: [] }
  }

  return {
    categories: categories
      .filter((c) => c.label.toLowerCase().includes(term))
      .slice(0, FACET_SUGGEST_LIMIT),
    manufacturers: manufacturers
      .filter((m) => m.toLowerCase().includes(term))
      .slice(0, FACET_SUGGEST_LIMIT),
  }
}

export async function fetchSuggestions(
  q: string,
  signal?: AbortSignal,
): Promise<Suggestions | null> {
  const term = q.trim()

  if (!term) {
    return null
  }

  const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal })

  if (!res.ok) {
    return null
  }

  const data = (await res.json()) as Suggestions
  const hasContent = (["categories", "devices", "manufacturers"] as const).some(
    (key) => (data[key]?.length ?? 0) > 0,
  )

  return hasContent ? data : null
}
