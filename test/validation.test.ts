import { describe, test } from "vitest";

import {
	validateOption,
	validatePhotos,
	validateText,
	validateUnset,
} from "../src/validation";
import type {
	ValidationPhotoSlot,
	ValidationTextPattern,
} from "../src/validation";

// same patterns as the mock declarations
const NAME: ValidationTextPattern = {
	multiline: false,
	length: { min: 3, max: 64 },
	kind: "letter",
	regex: "[\\p{L}\\p{M}\\p{N}\\p{P}\\p{Zs}\\p{Sc}\\p{Sm}]",
};
const EAN: ValidationTextPattern = { multiline: false, kind: "ean" };

describe("validateText (name)", () => {
	test.for([
		"Hue White A19",
		"FRITZ!Box 6690 Cable",
		"MacBook Air (M1, 2020)",
		"PositionableRollerShutterWithLowSpeedManagement",
		"Sonoff ZBMINI-L2",
		"Türkontakt Café 3€",
	])("accepts %j", (value, t) => {
		t.expect(validateText(value, NAME)).toEqual([]);
	});

	test("accepts empty, as fields are optional", (t) => {
		t.expect(validateText("", NAME)).toEqual([]);
	});

	test("rejects too short", (t) => {
		t.expect(validateText("99", NAME)).toEqual([
			{ code: "too-short", min: 3, length: 2 },
		]);
	});

	test("rejects too long", (t) => {
		t.expect(validateText("a".repeat(65), NAME)).toEqual([
			{ code: "too-long", max: 64, length: 65 },
		]);
	});

	test("pinpoints emoji by code point", (t) => {
		t.expect(validateText("Lamp 💡 Pro", NAME)).toEqual([
			{ code: "invalid-character", index: 5, character: "💡" },
		]);
	});

	test("counts emoji as one character", (t) => {
		t.expect(validateText("💡💡", NAME)).toEqual([
			{ code: "invalid-character", index: 0, character: "💡" },
			{ code: "too-short", min: 3, length: 2 },
		]);
	});

	test("rejects tab", (t) => {
		t.expect(validateText("Hue\tGo", NAME)).toEqual([
			{ code: "invalid-character", index: 3, character: "\t" },
		]);
	});

	test("reports pasted line break as multiline only", (t) => {
		t.expect(validateText("Hue Go\nPortable", NAME)).toEqual([
			{ code: "multiline" },
		]);
	});

	test("allows line breaks when multiline", (t) => {
		t.expect(
			validateText("first line\nsecond line", {
				multiline: true,
				kind: "letter",
				regex: "[\\p{L}\\p{Zs}]",
			}),
		).toEqual([]);
	});
});

describe("validateText (ean)", () => {
	test.for(["4006381333931", "96385074"])("accepts %j", (value, t) => {
		t.expect(validateText(value, EAN)).toEqual([]);
	});

	test("rejects wrong check digit", (t) => {
		t.expect(validateText("4006381333932", EAN)).toEqual([
			{ code: "ean-checksum" },
		]);
	});

	test("rejects upc-a length", (t) => {
		t.expect(validateText("036000291452", EAN)).toEqual([
			{ code: "ean-length", length: 12 },
		]);
	});

	test("pinpoints spaces as printed under barcodes", (t) => {
		t.expect(validateText("4 006381 333931", EAN)).toEqual([
			{ code: "invalid-character", index: 1, character: " " },
		]);
	});
});

describe("validateOption", () => {
	const ids = new Set(["local", "cloud-ish", "cloud"]);

	test("accepts known and empty", (t) => {
		t.expect(validateOption("cloud", ids)).toEqual([]);
		t.expect(validateOption("", ids)).toEqual([]);
	});

	test("rejects unknown", (t) => {
		t.expect(validateOption("hybrid", ids)).toEqual([
			{ code: "unknown-option" },
		]);
	});
});

describe("validatePhotos", () => {
	const SLOTS: ValidationPhotoSlot[] = [
		{ constrained: true, categories: ["packshot", "hero-shot"] },
		{ constrained: false },
	];

	test("accepts empty slots and allowed categories", (t) => {
		t.expect(validatePhotos([null, null], SLOTS)).toEqual([]);
		t.expect(
			validatePhotos(
				[
					{ type: "image/jpeg", category: "hero-shot" },
					{ type: "image/png", category: "unboxing" },
				],
				SLOTS,
			),
		).toEqual([]);
	});

	test("rejects files that aren't images", (t) => {
		t.expect(
			validatePhotos(
				[{ type: "application/pdf", category: "packshot" }],
				SLOTS,
			),
		).toEqual([{ code: "photo-type", slot: 0 }]);
	});

	test("rejects missing or disallowed categories", (t) => {
		t.expect(
			validatePhotos(
				[
					{ type: "image/jpeg", category: "unboxing" },
					{ type: "image/jpeg", category: "" },
				],
				SLOTS,
			),
		).toEqual([
			{ code: "photo-category", slot: 0 },
			{ code: "photo-category", slot: 1 },
		]);
	});
});

describe("validateUnset", () => {
	test("keeps an empty value empty but never removes a set one", (t) => {
		t.expect(validateUnset("", "")).toEqual([]);
		t.expect(validateUnset("true", "")).toEqual([]);
		t.expect(validateUnset("false", "true")).toEqual([]);
		t.expect(validateUnset("", "true")).toEqual([{ code: "unset" }]);
	});
});
