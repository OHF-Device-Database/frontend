import { describe, test, vi } from "vitest";

import {
	browseFiltersFromSearchParams,
	browseFiltersToHref,
	browseFiltersToQuery,
	browseFiltersToSearchParams,
	cleared,
	withCategoryToggled,
	withManufacturerToggled,
	withoutCategory,
	withoutManufacturer,
} from "../src/types/browse";

vi.mock("astro:env/server", () => ({ API_AUTHORITY: "https://example.com" }));

describe("browseFiltersFromSearchParams", () => {
	test("parses every dimension", (t) => {
		const filters = browseFiltersFromSearchParams(
			new URLSearchParams(
				"q=hue&category=lighting&category=cleaning&manufacturer=Signify&local=1",
			),
		);
		t.expect(filters).toEqual({
			term: "hue",
			category: new Set(["lighting", "cleaning"]),
			categoryMode: "include",
			manufacturer: new Set(["Signify"]),
			manufacturerMode: "include",
			localOnly: true,
		});
	});

	test("parses exclude modes", (t) => {
		const filters = browseFiltersFromSearchParams(
			new URLSearchParams(
				"category=lighting&categoryMode=exclude&manufacturer=Signify&manufacturerMode=exclude",
			),
		);
		t.expect(filters.categoryMode).toBe("exclude");
		t.expect(filters.manufacturerMode).toBe("exclude");
	});

	test("treats unknown modes as include", (t) => {
		const filters = browseFiltersFromSearchParams(
			new URLSearchParams("categoryMode=banana"),
		);
		t.expect(filters.categoryMode).toBe("include");
	});

	test("drops category ids the API does not know", (t) => {
		const filters = browseFiltersFromSearchParams(
			new URLSearchParams("category=sensors&category=lighting"),
		);
		t.expect(filters.category).toEqual(new Set(["lighting"]));
	});

	test("treats a blank term as absent", (t) => {
		const filters = browseFiltersFromSearchParams(
			new URLSearchParams("q=%20%20"),
		);
		t.expect(filters.term).toBeUndefined();
	});
});

describe("browseFiltersToSearchParams", () => {
	test("round-trips through the URL", (t) => {
		const params = new URLSearchParams(
			"q=hue&category=cleaning&category=lighting&categoryMode=exclude&manufacturer=Signify&local=1",
		);
		const roundTripped = browseFiltersToSearchParams(
			browseFiltersFromSearchParams(params),
		);
		t.expect(roundTripped.toString()).toBe(params.toString());
	});

	test("omits empty dimensions", (t) => {
		const href = browseFiltersToHref(
			browseFiltersFromSearchParams(new URLSearchParams()),
		);
		t.expect(href).toBe("/browse");
	});

	test("omits a mode with no selections", (t) => {
		const href = browseFiltersToHref(
			browseFiltersFromSearchParams(
				new URLSearchParams("categoryMode=exclude&manufacturerMode=exclude"),
			),
		);
		t.expect(href).toBe("/browse");
	});
});

describe("browseFiltersToQuery", () => {
	test("maps local-only to excluding online, keeping unknown connectivity", (t) => {
		const query = browseFiltersToQuery(
			browseFiltersFromSearchParams(new URLSearchParams("local=1")),
		);
		t.expect(query).toEqual({ "!connectivity": new Set(["online"]) });
	});

	test("maps exclude modes to negated dimensions", (t) => {
		const query = browseFiltersToQuery(
			browseFiltersFromSearchParams(
				new URLSearchParams(
					"category=lighting&categoryMode=exclude&manufacturer=Signify&manufacturerMode=exclude",
				),
			),
		);
		t.expect(query).toEqual({
			"!category": new Set(["lighting"]),
			"!manufacturer": new Set(["Signify"]),
		});
	});

	test("omits empty dimensions entirely", (t) => {
		const query = browseFiltersToQuery(
			browseFiltersFromSearchParams(new URLSearchParams()),
		);
		t.expect(query).toEqual({});
	});
});

describe("modifiers", () => {
	test("withCategoryToggled adds and removes", (t) => {
		const base = browseFiltersFromSearchParams(
			new URLSearchParams("category=lighting"),
		);
		t.expect(withCategoryToggled(base, "cleaning").category).toEqual(
			new Set(["lighting", "cleaning"]),
		);
		t.expect(withCategoryToggled(base, "lighting").category).toEqual(new Set());
	});

	test("removing the last selection resets the mode", (t) => {
		const category = browseFiltersFromSearchParams(
			new URLSearchParams("category=lighting&categoryMode=exclude"),
		);
		t.expect(withCategoryToggled(category, "lighting").categoryMode).toBe(
			"include",
		);
		const manufacturer = browseFiltersFromSearchParams(
			new URLSearchParams("manufacturer=Signify&manufacturerMode=exclude"),
		);
		t.expect(
			withManufacturerToggled(manufacturer, "Signify").manufacturerMode,
		).toBe("include");
	});

	test("keeping other selections keeps the mode", (t) => {
		const base = browseFiltersFromSearchParams(
			new URLSearchParams(
				"category=lighting&category=cleaning&categoryMode=exclude",
			),
		);
		t.expect(withCategoryToggled(base, "lighting").categoryMode).toBe(
			"exclude",
		);
	});

	test("withoutCategory drops only the category dimension", (t) => {
		const base = browseFiltersFromSearchParams(
			new URLSearchParams(
				"q=hue&category=lighting&categoryMode=exclude&manufacturer=Signify&manufacturerMode=exclude&local=1",
			),
		);
		t.expect(withoutCategory(base)).toEqual({
			term: "hue",
			category: new Set(),
			categoryMode: "include",
			manufacturer: new Set(["Signify"]),
			manufacturerMode: "exclude",
			localOnly: true,
		});
	});

	test("withoutManufacturer drops only the manufacturer dimension", (t) => {
		const base = browseFiltersFromSearchParams(
			new URLSearchParams(
				"q=hue&category=lighting&categoryMode=exclude&manufacturer=Signify&manufacturerMode=exclude&local=1",
			),
		);
		t.expect(withoutManufacturer(base)).toEqual({
			term: "hue",
			category: new Set(["lighting"]),
			categoryMode: "exclude",
			manufacturer: new Set(),
			manufacturerMode: "include",
			localOnly: true,
		});
	});

	test("cleared drops filters but keeps the term", (t) => {
		const base = browseFiltersFromSearchParams(
			new URLSearchParams(
				"q=hue&category=lighting&categoryMode=exclude&local=1",
			),
		);
		t.expect(cleared(base)).toEqual({
			term: "hue",
			category: new Set(),
			categoryMode: "include",
			manufacturer: new Set(),
			manufacturerMode: "include",
			localOnly: false,
		});
	});
});
