import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DeviceCategoryTopLevelId } from "../src/types/category";
import {
	HOME_CATEGORY_DRAWINGS,
	HOME_DRAWINGS,
	HOME_OPENING,
	homeArtId,
	homeArtSymbol,
	homeSlotSpec,
} from "../src/utilities/home-art";
import {
	detent,
	footerStep,
	rowOpacity,
	rowParting,
	spinIn,
	spinStagger,
	stepToward,
} from "../src/utilities/home-motion";

const drawingFile = (drawing: string): string => {
	const group = drawing.split("-")[0] ?? drawing;
	return fileURLToPath(
		new URL(
			`../src/assets/illustrations/categories/${group}/${drawing}-animated.svg`,
			import.meta.url,
		),
	);
};

describe("home art", () => {
	it("has drawings for every top level category", () => {
		for (const id of DeviceCategoryTopLevelId.options) {
			expect(HOME_CATEGORY_DRAWINGS[id].length, id).toBeGreaterThan(0);
		}
	});

	it("only names drawings that exist", () => {
		const named = new Set([
			...HOME_DRAWINGS,
			...Object.values(HOME_CATEGORY_DRAWINGS).flat(),
			...HOME_OPENING.flat().flatMap((slot) => {
				const spec = homeSlotSpec(slot);
				return spec.kind === "dash" ? [] : [spec.drawing];
			}),
		]);
		for (const drawing of named) {
			expect(existsSync(drawingFile(drawing)), drawing).toBe(true);
		}
	});

	it("opens every reel with the same number of slots", () => {
		expect(new Set(HOME_OPENING.map((reel) => reel.length)).size).toBe(1);
	});

	it("turns a slot into a dashed frame or a card", () => {
		expect(homeSlotSpec([1.13])).toEqual({ kind: "dash" });
		expect(homeSlotSpec([1.13, "sand", "lighting", "FIG. 1."])).toEqual({
			kind: "sand",
			drawing: "lighting",
			figure: "FIG. 1.",
		});
	});

	it("wraps a drawing as a symbol and drops its style block", () => {
		const symbol = homeArtSymbol(
			"lighting",
			'<svg xmlns="http://www.w3.org/2000/svg" class="cd" viewBox="-1 -2 3 4" tabindex="0"><style>path{fill:red}</style><g class="pt"><path class="pf" d="M0 0"/></g></svg>',
		);
		expect(symbol).toBe(
			`<symbol id="${homeArtId("lighting")}" viewBox="-1 -2 3 4" overflow="visible"><g class="home-art"><g class="pt"><path class="pf" d="M0 0"/></g></g></symbol>`,
		);
	});

	it("rejects a file that is not a drawing", () => {
		expect(() => homeArtSymbol("lighting", "<p>nope</p>")).toThrow();
	});
});

describe("home motion", () => {
	it("starts a spin fast and lands it on its distance", () => {
		expect(spinIn(0, 100, 2)).toEqual({ position: 0, velocity: 200 });
		expect(spinIn(2, 100, 2)).toEqual({ position: 100, velocity: 0 });
		expect(spinIn(5, 100, 2)).toEqual({ position: 100, velocity: 0 });
		const half = spinIn(1, 100, 2);
		expect(half.position).toBeCloseTo(93.75);
		expect(half.velocity).toBeCloseTo(25);
	});

	it("ends the whole spin together however many reels show", () => {
		// last reel lands at spin + stagger x (reels - 1)
		expect(spinStagger(4, 0.34) * 3).toBeCloseTo(1.02);
		expect(spinStagger(8, 0.34) * 7).toBeCloseTo(1.02);
		expect(spinStagger(1, 0.34)).toBeCloseTo(0.34);
	});

	it("pulls the list toward the nearest row", () => {
		expect(detent(3)).toBe(3);
		expect(detent(3.2)).toBeCloseTo(3.11);
		expect(detent(3.8)).toBeCloseTo(3.89);
	});

	it("parts and fades the rows around the reading line", () => {
		expect(rowParting(0)).toBe(0);
		expect(rowParting(4)).toBeCloseTo(7, 1);
		expect(rowParting(-4)).toBeCloseTo(-7, 1);
		expect(rowOpacity(0, 1)).toBe(1);
		expect(rowOpacity(5, 1)).toBeCloseTo(0.32);
		expect(rowOpacity(9, 1)).toBeCloseTo(0.32);
		expect(rowOpacity(0, 0)).toBeCloseTo(0.45);
	});

	it("moves a timed change toward its target and stops there", () => {
		expect(stepToward(0, 1, 0.11, 0.55)).toBeCloseTo(0.2);
		expect(stepToward(0.9, 1, 0.11, 0.55)).toBe(1);
		expect(stepToward(0.1, 0, 0.11, 0.55)).toBe(0);
		expect(stepToward(1, 1, 0.11, 0.55)).toBe(1);
	});

	it("opens the footer bands one after the other, from the footer up", () => {
		const heights = (progress: number) =>
			[0, 1, 2, 3, 4, 5].map((index) => footerStep(progress, index, 6, 18));
		expect(heights(0)).toEqual([0, 0, 0, 0, 0, 0]);
		expect(heights(1)).toEqual([18, 18, 18, 18, 18, 18]);
		const part = heights(0.3);
		expect(part[0]).toBe(18);
		expect(part[1]).toBeGreaterThan(part[2] ?? 0);
		expect(part[5]).toBe(0);
	});
});
