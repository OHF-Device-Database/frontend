import { describe, test } from "vitest";

import {
	ROLODEX_CARD_ON,
	ROLODEX_LINE,
	ROLODEX_STEP,
	ROLODEX_VIEW_BOX,
	rolodexCards,
	rolodexDrawing,
	rolodexEase,
	rolodexSettle,
} from "../src/utilities/rolodex";

const count = (markup: string, part: string): number =>
	markup.split(part).length - 1;

describe("rolodexCards", () => {
	test("has one card at the top when the wheel is at rest", (t) => {
		const cards = rolodexCards(0);
		t.expect(cards.filter(({ on }) => on)).toEqual([
			{ angle: 90, reach: 20, on: true },
		]);
	});

	test("has no card at the top half way between two", (t) => {
		t.expect(rolodexCards(ROLODEX_STEP / 2).some(({ on }) => on)).toBe(false);
	});

	test("stands the same a whole card or a whole turn on", (t) => {
		const rest = rolodexCards(0);
		const sorted = (turn: number) =>
			rolodexCards(turn)
				.map(({ angle, reach, on }) => ({
					angle: Math.round(angle),
					reach: Number(reach.toFixed(4)),
					on,
				}))
				.toSorted((a, b) => a.angle - b.angle);

		t.expect(sorted(ROLODEX_STEP)).toEqual(sorted(0));
		t.expect(sorted(-ROLODEX_STEP * 7)).toEqual(sorted(0));
		t.expect(sorted(360)).toEqual(sorted(0));
		t.expect(rest).toHaveLength(12);
	});

	test("folds a card into the drum at the front of the fan", (t) => {
		const reaches = (turn: number) =>
			rolodexCards(turn)
				.toSorted((a, b) => a.angle - b.angle)
				.map(({ reach }) => reach);

		// the lowest card is the shortest, the rest are full length
		const [lowest, ...rest] = reaches(0);
		t.expect(lowest).toBeGreaterThan(6);
		t.expect(lowest).toBeLessThan(20);
		t.expect(rest.slice(1).every((reach) => reach === 20)).toBe(true);

		// a card that has all but folded away is not drawn: here the one at
		// -43.9 degrees is left out
		const lowestAngle = Math.min(
			...rolodexCards(-7.9).map(({ angle }) => angle),
		);
		t.expect(lowestAngle).toBeCloseTo(-25.9, 5);
	});
});

describe("rolodexDrawing", () => {
	test("draws the frame, the cards and the lines on the top card", (t) => {
		const markup = rolodexDrawing(0);
		t.expect(markup.startsWith(`<svg viewBox="${ROLODEX_VIEW_BOX}"`)).toBe(
			true,
		);
		// 15 faces of the frame, 12 cards, 2 lines
		t.expect(count(markup, "<path")).toBe(29);
		t.expect(count(markup, `class="${ROLODEX_CARD_ON}"`)).toBe(1);
		t.expect(count(markup, `class="${ROLODEX_LINE}"`)).toBe(2);
	});

	test("draws no lines while no card is at the top", (t) => {
		const markup = rolodexDrawing(ROLODEX_STEP / 2);
		t.expect(count(markup, ROLODEX_CARD_ON)).toBe(0);
		t.expect(count(markup, ROLODEX_LINE)).toBe(0);
	});

	test("draws the same wheel a whole card on", (t) => {
		t.expect(rolodexDrawing(ROLODEX_STEP * 3)).toBe(rolodexDrawing(0));
		t.expect(rolodexDrawing(-ROLODEX_STEP)).toBe(rolodexDrawing(0));
	});

	test("stays inside its view box all the way round", (t) => {
		const [left = 0, top = 0, width = 0, height = 0] =
			ROLODEX_VIEW_BOX.split(" ").map(Number);

		for (let turn = 0; turn < ROLODEX_STEP; turn += 0.5) {
			const numbers = [...rolodexDrawing(turn).matchAll(/ d="([^"]+)"/g)]
				.flatMap(([, d = ""]) => d.match(/-?\d+(?:\.\d+)?/g) ?? [])
				.map(Number);
			const xs = numbers.filter((_, index) => index % 2 === 0);
			const ys = numbers.filter((_, index) => index % 2 === 1);

			t.expect(Math.min(...xs)).toBeGreaterThanOrEqual(left);
			t.expect(Math.max(...xs)).toBeLessThanOrEqual(left + width);
			t.expect(Math.min(...ys)).toBeGreaterThanOrEqual(top);
			t.expect(Math.max(...ys)).toBeLessThanOrEqual(top + height);
		}
	});
});

describe("rolodexSettle", () => {
	test("picks the nearest card", (t) => {
		t.expect(rolodexSettle(28)).toBe(36);
		t.expect(rolodexSettle(26)).toBe(18);
		t.expect(rolodexSettle(-10)).toBe(-18);
		t.expect(rolodexSettle(-360.4)).toBe(-360);
		t.expect(Math.abs(rolodexSettle(3))).toBe(0);
	});
});

describe("rolodexEase", () => {
	test("moves toward the target without passing it", (t) => {
		const next = rolodexEase(0, 18, 1 / 60);
		t.expect(next).toBeGreaterThan(0);
		t.expect(next).toBeLessThan(18);
		t.expect(rolodexEase(18, 0, 1 / 60)).toBeLessThan(18);
	});

	test("covers the same ground at any frame rate", (t) => {
		const once = rolodexEase(0, 18, 1 / 30);
		const twice = rolodexEase(rolodexEase(0, 18, 1 / 60), 18, 1 / 60);
		t.expect(twice).toBeCloseTo(once, 10);
	});

	test("lands on the target once it is close", (t) => {
		t.expect(rolodexEase(17.995, 18, 1 / 60)).toBe(18);
		t.expect(rolodexEase(18, 18, 1 / 60)).toBe(18);
	});

	test("stays put when no time has passed", (t) => {
		t.expect(rolodexEase(4, 18, 0)).toBe(4);
	});
});
