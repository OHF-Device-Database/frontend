import { z } from "astro/zod";

export const LocalControl = z.enum(["always", "sometimes", "never"]);
export type LocalControl = z.infer<typeof LocalControl>;

export const CloudDependency = z.enum(["none", "optional", "required"]);
export type CloudDependency = z.infer<typeof CloudDependency>;

export const Device = z.object({
    id: z.string(),
    name: z.string(),
    manufacturer: z.string(),
    model: z.string(),
    category: z.string(),
    local: LocalControl,
    cloud: CloudDependency,
    summary: z.string(),
    reports: z.number(),
    installs: z.number(),
    haIntegration: z.string().default(""),
    entityTypes: z.array(z.string()).default([]),
    softwareVersion: z.string().default(""),
    firstSeen: z.string().default(""),
    lastVerified: z.string().default(""),
});
export type Device = z.infer<typeof Device>;

export interface Category {
    id: string;
    label: string;
}

export function requiresInternet(device: Device): boolean {
    return !(device.local === "always" && device.cloud !== "required");
}

export function manufacturerFacets(devices: Device[]): string[] {
    return [...new Set(devices.map((device) => device.manufacturer))].toSorted();
}

export function categoryFacets(devices: Device[]): string[] {
    return [...new Set(devices.map((device) => device.category))];
}

export {
    applyFilters,
    parseBrowseFilters,
    filtersToSearchParams,
    browseFiltersHref,
    facetCounts,
    frequencyCounts,
    matches,
    activeFilterChips,
    removeFilterChip,
    hasActiveFilters,
    activeFilterCount,
    clearedFilters,
    categoryOptions,
    manufacturerOptions,
    topOptions,
    FACET_SIDEBAR_LIMIT,
    EMPTY_BROWSE_FILTERS,
    type BrowseFilters,
    type FilterChip,
    type FilterMode,
    type FacetDimension,
} from "./browse-filters";
