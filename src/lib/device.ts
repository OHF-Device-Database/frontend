import { z } from "astro/zod"

export const LocalControl = z.enum(["always", "sometimes", "never"])
export type LocalControl = z.infer<typeof LocalControl>

export const CloudDependency = z.enum(["none", "optional", "required"])
export type CloudDependency = z.infer<typeof CloudDependency>

export const Connectivity = z.enum(["online", "offline"])
export type Connectivity = z.infer<typeof Connectivity>

export const VersionInfo = z.object({
  version: z.string(),
  active: z.number().optional(),
  firstEncountered: z.string().default(""),
})
export type VersionInfo = z.infer<typeof VersionInfo>

export const Device = z.object({
  id: z.string(),
  name: z.string(),
  manufacturer: z.string(),
  model: z.string(),
  category: z.string(),
  local: LocalControl.optional(),
  cloud: CloudDependency.optional(),
  connectivity: Connectivity.optional(),
  summary: z.string().default(""),
  reports: z.number().default(0),
  installs: z.number().default(0),
  haIntegration: z.string().default(""),
  haIntegrationDomain: z.string().default(""),
  entityTypes: z.array(z.string()).default([]),
  softwareVersion: z.string().default(""),
  softwareVersions: z.array(z.string()).default([]),
  hardwareVersions: z.array(z.string()).default([]),
  softwareVersionInfo: z.array(VersionInfo).default([]),
  hardwareVersionInfo: z.array(VersionInfo).default([]),
  firstSeen: z.string().default(""),
  lastVerified: z.string().default(""),
})
export type Device = z.infer<typeof Device>
export type DeviceInput = z.input<typeof Device>

export interface Category {
  id: string
  label: string
}

export type InternetStatus = "requires" | "local" | "unknown"

export function internetStatus(device: Device): InternetStatus {
  if (device.connectivity === "online") {
    return "requires"
  }
  if (device.connectivity === "offline") {
    return "local"
  }
  if (device.local && device.cloud) {
    return device.local === "always" && device.cloud !== "required" ? "local" : "requires"
  }

  return "unknown"
}

export function requiresInternet(device: Device): boolean {
  return internetStatus(device) === "requires"
}

export const CONNECTIVITY_DISPLAY: Record<InternetStatus, { cls: string; label: string }> = {
  requires: { cls: "net-yes", label: "Requires internet" },
  local: { cls: "net-no", label: "Local connection" },
  unknown: { cls: "net-unknown", label: "Connectivity unknown" },
}

export function connectivityDisplay(device: Device): { cls: string; label: string } {
  return CONNECTIVITY_DISPLAY[internetStatus(device)]
}

export function manufacturerFacets(devices: Device[]): string[] {
  return [...new Set(devices.map((device) => device.manufacturer))].toSorted()
}

export function categoryFacets(devices: Device[]): string[] {
  return [...new Set(devices.map((device) => device.category))]
}

export {
  activeFilterChips,
  activeFilterCount,
  applyFilters,
  browseFiltersHref,
  categoryOptions,
  clearedFilters,
  EMPTY_BROWSE_FILTERS,
  FACET_SIDEBAR_LIMIT,
  facetCounts,
  filtersToSearchParams,
  frequencyCounts,
  hasActiveFilters,
  manufacturerOptions,
  matches,
  parseBrowseFilters,
  removeFilterChip,
  topOptions,
  type BrowseFilters,
  type FacetDimension,
  type FilterChip,
  type FilterMode,
} from "./browse-filters"
