import { DeviceCategoryTopLevelId } from "../category";
import type { IoGetDevicesQuery } from "../../io/device";

export type BrowseFilterMode = "include" | "exclude";

export type BrowseFilters = {
	term?: string | undefined;
	category: Set<DeviceCategoryTopLevelId>;
	categoryMode: BrowseFilterMode;
	manufacturer: Set<string>;
	manufacturerMode: BrowseFilterMode;
	localOnly: boolean;
};

const modeFromParam = (value: string | null): BrowseFilterMode =>
	value === "exclude" ? "exclude" : "include";

export const browseFiltersFromSearchParams = (
	params: URLSearchParams,
): BrowseFilters => {
	const term = params.get("q")?.trim();

	return {
		term: typeof term === "string" && term.length > 0 ? term : undefined,
		category: new Set(
			params
				.getAll("category")
				.flatMap((id) =>
					DeviceCategoryTopLevelId.safeParse(id).success
						? [id as DeviceCategoryTopLevelId]
						: [],
				),
		),
		categoryMode: modeFromParam(params.get("categoryMode")),
		manufacturer: new Set(
			params.getAll("manufacturer").filter((name) => name.length > 0),
		),
		manufacturerMode: modeFromParam(params.get("manufacturerMode")),
		localOnly: params.get("local") === "1",
	};
};

export const browseFiltersToSearchParams = (
	filters: BrowseFilters,
): URLSearchParams => {
	const params = new URLSearchParams();
	if (typeof filters.term !== "undefined") {
		params.set("q", filters.term);
	}
	for (const id of [...filters.category].toSorted()) {
		params.append("category", id);
	}
	if (filters.category.size > 0 && filters.categoryMode === "exclude") {
		params.set("categoryMode", "exclude");
	}
	for (const name of [...filters.manufacturer].toSorted()) {
		params.append("manufacturer", name);
	}
	if (filters.manufacturer.size > 0 && filters.manufacturerMode === "exclude") {
		params.set("manufacturerMode", "exclude");
	}
	if (filters.localOnly) {
		params.set("local", "1");
	}

	return params;
};

export const browseFiltersToHref = (filters: BrowseFilters): string => {
	const qs = browseFiltersToSearchParams(filters).toString();

	return `/browse${qs.length > 0 ? `?${qs}` : ""}`;
};

export const browseFiltersToQuery = (
	filters: BrowseFilters,
): IoGetDevicesQuery => ({
	...(typeof filters.term !== "undefined" ? { term: filters.term } : {}),
	...(filters.category.size > 0
		? filters.categoryMode === "exclude"
			? { "!category": filters.category }
			: { category: filters.category }
		: {}),
	...(filters.manufacturer.size > 0
		? filters.manufacturerMode === "exclude"
			? { "!manufacturer": filters.manufacturer }
			: { manufacturer: filters.manufacturer }
		: {}),
	...(filters.localOnly
		? { "!connectivity": new Set(["online"] as const) }
		: {}),
});

export const browseFiltersCount = (filters: BrowseFilters): number =>
	filters.category.size +
	filters.manufacturer.size +
	(filters.localOnly ? 1 : 0);

const withToggled = <T>(set: Set<T>, value: T): Set<T> => {
	const next = new Set(set);
	if (next.has(value)) {
		next.delete(value);
	} else {
		next.add(value);
	}

	return next;
};

export const withCategoryToggled = (
	filters: BrowseFilters,
	id: DeviceCategoryTopLevelId,
): BrowseFilters => {
	const category = withToggled(filters.category, id);

	return {
		...filters,
		category,
		categoryMode: category.size === 0 ? "include" : filters.categoryMode,
	};
};

export const withManufacturerToggled = (
	filters: BrowseFilters,
	name: string,
): BrowseFilters => {
	const manufacturer = withToggled(filters.manufacturer, name);

	return {
		...filters,
		manufacturer,
		manufacturerMode:
			manufacturer.size === 0 ? "include" : filters.manufacturerMode,
	};
};

export const withLocalOnly = (
	filters: BrowseFilters,
	localOnly: boolean,
): BrowseFilters => ({ ...filters, localOnly });

export const withoutTerm = (filters: BrowseFilters): BrowseFilters => ({
	...filters,
	term: undefined,
});

/** drops the category selection, e.g. to compute the category facet itself */
export const withoutCategory = (filters: BrowseFilters): BrowseFilters => ({
	...filters,
	category: new Set(),
	categoryMode: "include",
});

/** drops the manufacturer selection, e.g. to compute the manufacturer facet itself */
export const withoutManufacturer = (filters: BrowseFilters): BrowseFilters => ({
	...filters,
	manufacturer: new Set(),
	manufacturerMode: "include",
});

export const cleared = (filters: BrowseFilters): BrowseFilters => ({
	...(typeof filters.term !== "undefined" ? { term: filters.term } : {}),
	category: new Set(),
	categoryMode: "include",
	manufacturer: new Set(),
	manufacturerMode: "include",
	localOnly: false,
});
