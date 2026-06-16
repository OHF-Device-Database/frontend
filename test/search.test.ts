import { describe, expect, it } from "vitest";
import { pickFacetSuggestions, QUICK_FILTERS } from "../src/lib/search";
import { DEVICE_CATEGORIES } from "../src/lib/categories";

const MANUFACTURERS = ["Aqara", "Signify Netherlands B.V.", "IKEA", "Google Inc.", "Apple"];

describe("pickFacetSuggestions", () => {
    it("returns nothing for an empty query", () => {
        const out = pickFacetSuggestions("   ", MANUFACTURERS, DEVICE_CATEGORIES);
        expect(out.categories).toHaveLength(0);
        expect(out.manufacturers).toHaveLength(0);
    });

    it("matches manufacturers case-insensitively by substring", () => {
        const out = pickFacetSuggestions("aqara", MANUFACTURERS, DEVICE_CATEGORIES);
        expect(out.manufacturers).toContain("Aqara");
    });

    it("matches categories by label", () => {
        const out = pickFacetSuggestions("light", MANUFACTURERS, DEVICE_CATEGORIES);
        expect(out.categories.some((c) => c.id === "lighting")).toBe(true);
    });

    it("caps each facet at five results", () => {
        const many = Array.from({ length: 20 }, (_, i) => `Maker ${i}`);
        const out = pickFacetSuggestions("maker", many, DEVICE_CATEGORIES);
        expect(out.manufacturers.length).toBeLessThanOrEqual(5);
    });
});

describe("QUICK_FILTERS", () => {
    it("each shipped quick filter has a title and at least one filter dimension", () => {
        for (const qf of QUICK_FILTERS) {
            expect(qf.title.length).toBeGreaterThan(0);
            const hasDimension =
                (qf.filters.category?.length ?? 0) > 0 ||
                (qf.filters.manufacturer?.length ?? 0) > 0 ||
                qf.filters.localOnly === true;
            expect(hasDimension).toBe(true);
        }
    });
});
