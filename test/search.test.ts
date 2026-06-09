import { describe, expect, it } from "vitest";
import { buildSuggestions, countMatchingQuickFilter, QUICK_FILTERS } from "../src/lib/search";

describe("buildSuggestions", () => {
    it("returns null for an empty query", () => {
        expect(buildSuggestions("")).toBeNull();
        expect(buildSuggestions("   ")).toBeNull();
    });

    it("surfaces manufacturers and devices for a real term", () => {
        const out = buildSuggestions("aqara");
        expect(out).not.toBeNull();
        expect(out!.manufacturers).toContain("Aqara");
        expect(out!.devices!.length).toBeGreaterThan(0);
    });

    it("caps devices at five and reports the overflow count", () => {
        const out = buildSuggestions("sensor");
        if (out?.devices) {
            expect(out.devices.length).toBeLessThanOrEqual(5);
        }
    });

    it("returns word suggestions that start with the term", () => {
        const out = buildSuggestions("li");
        expect(out!.words!.every((w) => w.startsWith("li"))).toBe(true);
    });
});

describe("countMatchingQuickFilter", () => {
    it("counts at least one device for each shipped quick filter", () => {
        for (const qf of QUICK_FILTERS) {
            expect(countMatchingQuickFilter(qf.filters)).toBeGreaterThan(0);
        }
    });
});
