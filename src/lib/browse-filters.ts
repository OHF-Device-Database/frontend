import type { Category, Device } from "./device";
import { requiresInternet } from "./device";
import { DEVICE_CATEGORIES, CATEGORY_LABEL } from "./categories";

export type FilterMode = "include" | "exclude";
export type FacetDimension = "category" | "manufacturer";

export interface BrowseFilters {
    q: string;
    category: Set<string>;
    manufacturer: Set<string>;
    categoryMode: FilterMode;
    manufacturerMode: FilterMode;
    localOnly: boolean;
}

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
    q: "",
    category: new Set(),
    manufacturer: new Set(),
    categoryMode: "include",
    manufacturerMode: "include",
    localOnly: false,
};

export function parseBrowseFilters(params: URLSearchParams): BrowseFilters {
    return {
        q: params.get("q") ?? "",
        category: new Set(params.getAll("category")),
        manufacturer: new Set(params.getAll("manufacturer")),
        categoryMode: params.get("categoryMode") === "exclude" ? "exclude" : "include",
        manufacturerMode: params.get("manufacturerMode") === "exclude" ? "exclude" : "include",
        localOnly: params.get("local") === "1",
    };
}

export function filtersToSearchParams(filters: BrowseFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q.trim()) {
        params.set("q", filters.q.trim());
    }
    for (const id of [...filters.category].sort()) {
        params.append("category", id);
    }
    for (const name of [...filters.manufacturer].sort()) {
        params.append("manufacturer", name);
    }
    if (filters.categoryMode === "exclude") {
        params.set("categoryMode", "exclude");
    }
    if (filters.manufacturerMode === "exclude") {
        params.set("manufacturerMode", "exclude");
    }
    if (filters.localOnly) {
        params.set("local", "1");
    }
    return params;
}

export function browseFiltersHref(filters: BrowseFilters, pathname = "/browse"): string {
    const qs = filtersToSearchParams(filters).toString();
    return qs ? `${pathname}?${qs}` : pathname;
}

function matchesQuery(device: Device, q: string): boolean {
    const term = q.trim().toLowerCase();
    if (term.length === 0) {
        return true;
    }
    return [device.name, device.manufacturer, device.model, device.summary]
        .join(" ")
        .toLowerCase()
        .includes(term);
}

function matchesDimension(device: Device, filters: BrowseFilters, dimension: FacetDimension): boolean {
    const set = filters[dimension];
    if (set.size === 0) {
        return true;
    }
    const value = dimension === "category" ? device.category : device.manufacturer;
    const has = set.has(value);
    const mode = dimension === "category" ? filters.categoryMode : filters.manufacturerMode;
    return mode === "exclude" ? !has : has;
}

export function matches(
    device: Device,
    filters: BrowseFilters,
    skipDimension: FacetDimension | null = null,
): boolean {
    if (!matchesQuery(device, filters.q)) {
        return false;
    }
    if (skipDimension !== "category" && !matchesDimension(device, filters, "category")) {
        return false;
    }
    if (skipDimension !== "manufacturer" && !matchesDimension(device, filters, "manufacturer")) {
        return false;
    }
    if (filters.localOnly && requiresInternet(device)) {
        return false;
    }
    return true;
}

export function applyFilters(devices: Device[], filters: BrowseFilters): Device[] {
    return devices.filter((device) => matches(device, filters));
}

export function facetCounts(
    devices: Device[],
    filters: BrowseFilters,
    dimension: FacetDimension,
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const device of devices) {
        if (!matches(device, filters, dimension)) {
            continue;
        }
        const key = dimension === "category" ? device.category : device.manufacturer;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

export function frequencyCounts(devices: Device[], dimension: FacetDimension): Map<string, number> {
    const counts = new Map<string, number>();
    for (const device of devices) {
        const key = dimension === "category" ? device.category : device.manufacturer;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

export function activeFilterCount(filters: BrowseFilters): number {
    return filters.category.size + filters.manufacturer.size + (filters.localOnly ? 1 : 0);
}

export function hasActiveFilters(filters: BrowseFilters): boolean {
    return activeFilterCount(filters) > 0 || filters.q.trim().length > 0;
}

export function clearedFilters(filters: BrowseFilters): BrowseFilters {
    return { ...EMPTY_BROWSE_FILTERS, q: filters.q };
}

export interface FilterChip {
    id: string;
    dim: "q" | FacetDimension | "local";
    label: string;
    summary: boolean;
}

export function activeFilterChips(filters: BrowseFilters): FilterChip[] {
    const chips: FilterChip[] = [];

    if (filters.q.trim()) {
        chips.push({ id: "q", dim: "q", label: filters.q.trim(), summary: false });
    }

    chips.push(
        ...dimensionChips(filters, "category", (id) => CATEGORY_LABEL[id] ?? id, "category", "categories"),
    );
    chips.push(
        ...dimensionChips(filters, "manufacturer", (id) => id, "manufacturer", "manufacturers"),
    );

    if (filters.localOnly) {
        chips.push({ id: "local", dim: "local", label: "Local control only", summary: false });
    }

    return chips;
}

function dimensionChips(
    filters: BrowseFilters,
    dim: FacetDimension,
    labelOf: (id: string) => string,
    singular: string,
    plural: string,
): FilterChip[] {
    const set = filters[dim];
    if (set.size === 0) {
        return [];
    }
    const mode = dim === "category" ? filters.categoryMode : filters.manufacturerMode;
    const not = mode === "exclude";

    if (not || set.size > 1) {
        const n = set.size;
        const noun = n === 1 ? singular : plural;
        return [{ id: dim, dim, label: `${not ? "Not " : ""}${n} ${noun}`, summary: true }];
    }

    const id = [...set][0];
    return [{ id: dim, dim, label: labelOf(id), summary: false }];
}

export function removeFilterChip(filters: BrowseFilters, chip: FilterChip): BrowseFilters {
    switch (chip.dim) {
        case "q":
            return { ...filters, q: "" };
        case "local":
            return { ...filters, localOnly: false };
        case "category":
            return { ...filters, category: new Set(), categoryMode: "include" };
        case "manufacturer":
            return { ...filters, manufacturer: new Set(), manufacturerMode: "include" };
        default:
            return filters;
    }
}

export function categoryOptions(): Category[] {
    return DEVICE_CATEGORIES;
}

export function manufacturerOptions(devices: Device[]): Category[] {
    return [...new Set(devices.map((d) => d.manufacturer))]
        .toSorted((a, b) => a.localeCompare(b))
        .map((name) => ({ id: name, label: name }));
}

export function topOptions(
    options: Category[],
    frequencies: Map<string, number>,
    selected: Set<string>,
    limit: number,
): Category[] {
    const byFreq = [...options].sort(
        (a, b) =>
            (frequencies.get(b.id) ?? 0) - (frequencies.get(a.id) ?? 0) || a.label.localeCompare(b.label),
    );
    const top = new Set(byFreq.slice(0, limit).map((o) => o.id));
    for (const id of selected) {
        top.add(id);
    }
    return byFreq.filter((o) => top.has(o.id));
}

export function groupByLetter(options: Category[]): (readonly [string, Category[]])[] {
    const groups = new Map<string, Category[]>();
    for (const option of options) {
        const head = (option.label[0] ?? "#").toUpperCase();
        const key = /[A-Z]/.test(head) ? head : "#";
        const list = groups.get(key) ?? [];
        list.push(option);
        groups.set(key, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export const FACET_SIDEBAR_LIMIT = 5;
