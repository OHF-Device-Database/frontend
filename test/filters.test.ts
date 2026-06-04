import { describe, expect, it } from "vitest";
import {
    applyFilters,
    facetCounts,
    parseBrowseFilters,
    browseFiltersHref,
    EMPTY_BROWSE_FILTERS,
    type BrowseFilters,
} from "../src/lib/browse-filters";
import { MOCK_DEVICES } from "../src/lib/mock-devices";

const filters = (over: Partial<BrowseFilters> = {}): BrowseFilters => ({
    ...EMPTY_BROWSE_FILTERS,
    category: new Set(over.category ?? []),
    manufacturer: new Set(over.manufacturer ?? []),
    ...over,
});

describe("applyFilters", () => {
    it("returns everything with empty filters", () => {
        expect(applyFilters(MOCK_DEVICES, filters())).toHaveLength(MOCK_DEVICES.length);
    });

    it("filters by free-text query", () => {
        const result = applyFilters(MOCK_DEVICES, filters({ q: "aqara" }));
        expect(result.length).toBeGreaterThan(0);
        expect(
            result.every((d) =>
                `${d.name} ${d.manufacturer} ${d.summary}`.toLowerCase().includes("aqara"),
            ),
        ).toBe(true);
    });

    it("includes a category", () => {
        const result = applyFilters(MOCK_DEVICES, filters({ category: new Set(["lighting"]) }));
        expect(result.length).toBeGreaterThan(0);
        expect(result.every((d) => d.category === "lighting")).toBe(true);
    });

    it("excludes a category in exclude mode", () => {
        const result = applyFilters(
            MOCK_DEVICES,
            filters({ category: new Set(["lighting"]), categoryMode: "exclude" }),
        );
        expect(result.every((d) => d.category !== "lighting")).toBe(true);
    });

    it("intersects category and local-only", () => {
        const result = applyFilters(
            MOCK_DEVICES,
            filters({ category: new Set(["lighting"]), localOnly: true }),
        );
        expect(result.every((d) => d.category === "lighting" && d.local === "always")).toBe(true);
    });
});

describe("facetCounts", () => {
    it("ignores its own dimension so counts stay stable", () => {
        const counts = facetCounts(MOCK_DEVICES, filters({ category: new Set(["lighting"]) }), "category");
        const lighting = MOCK_DEVICES.filter((d) => d.category === "lighting").length;
        expect(counts.get("lighting")).toBe(lighting);
    });
});

describe("url round-trip", () => {
    it("serializes and parses back to an equivalent filter", () => {
        const f = filters({
            q: "hue",
            category: new Set(["lighting"]),
            manufacturer: new Set(["Aqara"]),
            categoryMode: "exclude",
            localOnly: true,
        });
        const href = browseFiltersHref(f);
        const parsed = parseBrowseFilters(new URLSearchParams(href.split("?")[1]));
        expect(parsed.q).toBe("hue");
        expect([...parsed.category]).toEqual(["lighting"]);
        expect([...parsed.manufacturer]).toEqual(["Aqara"]);
        expect(parsed.categoryMode).toBe("exclude");
        expect(parsed.localOnly).toBe(true);
    });
});
