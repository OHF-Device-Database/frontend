import { z } from "astro/zod";

import mock from "./mock/declarations.json";

/** translations keyed by locale, `en` is always present */
export const IoDeclarationLocalized = z
	.object({ en: z.string() })
	.catchall(z.string());

const IoDeclarationBase = {
	id: z.string().min(1),
	label: IoDeclarationLocalized,
	hint: z.optional(IoDeclarationLocalized),
	description: z.optional(IoDeclarationLocalized),
};

const IoDeclarationTextPatternBase = {
	multiline: z.boolean(),
	length: z.optional(
		z
			.object({
				min: z.optional(z.int().nonnegative()),
				max: z.optional(z.int().positive()),
			})
			.refine(
				({ min, max }) =>
					typeof min === "undefined" ||
					typeof max === "undefined" ||
					min <= max,
				{ message: "length.min exceeds length.max" },
			),
	),
};

/** single character class, applied character by character */
const IoDeclarationCharacterClass = z.string().refine(
	(source) => {
		try {
			new RegExp(source, "u");
			return true;
		} catch {
			return false;
		}
	},
	{ message: "invalid regex" },
);

export const IoDeclarationTextPattern = z.discriminatedUnion("kind", [
	z.object({
		...IoDeclarationTextPatternBase,
		kind: z.literal("letter"),
		regex: IoDeclarationCharacterClass,
	}),
	z.object({
		...IoDeclarationTextPatternBase,
		kind: z.literal("ean"),
	}),
]);

export const IoDeclarationText = z.object({
	...IoDeclarationBase,
	type: z.literal("text"),
	pattern: IoDeclarationTextPattern,
});

export const IoDeclarationToggle = z.object({
	...IoDeclarationBase,
	type: z.literal("toggle"),
});

export const IoDeclarationPickerOption = z.object({
	id: z.string().min(1),
	title: IoDeclarationLocalized,
	subtitle: z.optional(IoDeclarationLocalized),
	/** name out of the icon set, unknown names fall back to a generic icon */
	icon: z.optional(z.string()),
});

export const IoDeclarationPickerResource = z.enum(["brand", "category"]);

export const IoDeclarationPicker = z.discriminatedUnion("resource", [
	z.object({
		...IoDeclarationBase,
		type: z.literal("picker"),
		resource: z.literal("none"),
		options: z
			.array(IoDeclarationPickerOption)
			.min(1)
			.refine(
				(options) =>
					new Set(options.map(({ id }) => id)).size === options.length,
				{ message: "duplicate option id" },
			),
	}),
	z.object({
		...IoDeclarationBase,
		type: z.literal("picker"),
		resource: IoDeclarationPickerResource,
	}),
]);

export const IoDeclarationPhotosSlot = z.discriminatedUnion("constrained", [
	z.object({
		constrained: z.literal(true),
		categories: z.array(z.string()).min(1),
	}),
	z.object({ constrained: z.literal(false) }),
]);

export const IoDeclarationPhotos = z
	.object({
		...IoDeclarationBase,
		type: z.literal("photos"),
		categories: z.record(
			z.string(),
			z.object({
				label: IoDeclarationLocalized,
				description: z.optional(IoDeclarationLocalized),
			}),
		),
		pattern: z.object({ slots: z.array(IoDeclarationPhotosSlot).min(1) }),
	})
	.superRefine(({ categories, pattern }, ctx) => {
		for (const [index, slot] of pattern.slots.entries()) {
			if (!slot.constrained) {
				continue;
			}
			for (const category of slot.categories) {
				if (!(category in categories)) {
					ctx.addIssue({
						code: "custom",
						path: ["pattern", "slots", index, "categories"],
						message: `unknown category <${category}>`,
					});
				}
			}
		}
	});

export const IoDeclaration = z.discriminatedUnion("type", [
	IoDeclarationText,
	IoDeclarationToggle,
	IoDeclarationPicker,
	IoDeclarationPhotos,
]);
export type IoDeclaration = z.infer<typeof IoDeclaration>;

export const IoDeclarations = z
	.array(IoDeclaration)
	.refine(
		(declarations) =>
			new Set(declarations.map(({ id }) => id)).size === declarations.length,
		{ message: "duplicate declaration id" },
	);

// mocked until the endpoint is available
export const getDeclarations = () =>
	Promise.resolve({ declarations: IoDeclarations.parse(mock) });
