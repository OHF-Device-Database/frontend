import { describe, test, vi } from "vitest";

import { getDeclarations, IoDeclarations } from "../src/io/declaration";
import { Declaration } from "../src/types/declaration";
import { localized } from "../src/utilities/localized";

vi.mock("astro:env/server", () => ({ API_AUTHORITY: "https://example.com" }));

const NAME = {
	id: "name",
	type: "text",
	label: { en: "Name" },
	pattern: {
		multiline: false,
		length: { min: 3, max: 64 },
		kind: "letter",
		regex: "[\\p{L}\\p{N}]",
	},
};

describe("getDeclarations", () => {
	test("mock parses into every declaration type", async (t) => {
		const { declarations } = await getDeclarations();
		t.expect(new Set(declarations.map(({ type }) => type))).toEqual(
			new Set(["text", "toggle", "picker", "photos"]),
		);
	});
});

describe("Declaration", () => {
	test("narrows text patterns by kind", (t) => {
		const result = Declaration.parse(NAME);
		t.expect(result.type === "text" && result.pattern.kind).toBe("letter");
	});

	test("rejects unknown type", (t) => {
		t.expect(Declaration.safeParse({ ...NAME, type: "slider" }).success).toBe(
			false,
		);
	});

	test("requires english translations", (t) => {
		t.expect(
			Declaration.safeParse({ ...NAME, label: { de: "Name" } }).success,
		).toBe(false);
	});

	test("rejects letter pattern without regex", (t) => {
		t.expect(
			Declaration.safeParse({
				...NAME,
				pattern: { multiline: false, kind: "letter" },
			}).success,
		).toBe(false);
	});

	test("rejects regex that does not compile in unicode mode", (t) => {
		t.expect(
			Declaration.safeParse({
				...NAME,
				pattern: { ...NAME.pattern, regex: "[\\p{Nope}]" },
			}).success,
		).toBe(false);
	});

	test("rejects length with min above max", (t) => {
		t.expect(
			Declaration.safeParse({
				...NAME,
				pattern: { ...NAME.pattern, length: { min: 10, max: 3 } },
			}).success,
		).toBe(false);
	});

	test("static picker requires unique options", (t) => {
		const picker = {
			id: "local-operation",
			type: "picker",
			label: { en: "Local Operation" },
			resource: "none",
		};
		const option = { id: "local", title: { en: "Fully Local" } };

		t.expect(Declaration.safeParse(picker).success).toBe(false);
		t.expect(
			Declaration.safeParse({ ...picker, options: [option, option] }).success,
		).toBe(false);
		t.expect(
			Declaration.safeParse({ ...picker, options: [option] }).success,
		).toBe(true);
	});

	test("rejects unknown picker resource", (t) => {
		t.expect(
			Declaration.safeParse({
				id: "brand",
				type: "picker",
				label: { en: "Brand" },
				resource: "vendor",
			}).success,
		).toBe(false);
	});

	test("rejects photo slots referencing unknown categories", (t) => {
		const result = Declaration.safeParse({
			id: "photos",
			type: "photos",
			label: { en: "Photos" },
			categories: { packshot: { label: { en: "Packshot" } } },
			pattern: {
				slots: [
					{ constrained: true, categories: ["packshot", "unboxing"] },
					{ constrained: false },
				],
			},
		});
		t.expect(result.success).toBe(false);
		t.expect(result.error?.issues[0]?.message).toBe(
			"unknown category <unboxing>",
		);
	});
});

describe("IoDeclarations", () => {
	const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});

	test("skips unsupported declarations and keeps the rest", (t) => {
		const warn = quiet();
		const declarations = IoDeclarations.parse([
			{ ...NAME, id: "rating", type: "rating" },
			NAME,
			{
				id: "duplicate-of",
				type: "picker",
				label: { en: "Duplicate of" },
				resource: "device",
			},
		]);
		t.expect(declarations.map(({ id }) => id)).toEqual(["name"]);
		t.expect(warn).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});

	test("keeps the first of repeated ids", (t) => {
		const warn = quiet();
		const declarations = IoDeclarations.parse([
			NAME,
			{ ...NAME, label: { en: "Other" } },
		]);
		t.expect(declarations.map(({ label }) => label.en)).toEqual(["Name"]);
		t.expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	test("still requires a list", (t) => {
		t.expect(IoDeclarations.safeParse({}).success).toBe(false);
	});
});

describe("localized", () => {
	test("picks english", (t) => {
		t.expect(localized({ en: "Name", de: "Name (de)" })).toBe("Name");
	});
});
