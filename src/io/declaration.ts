import { z } from "astro/zod";

import { getDimensions } from "./dimension";
import mock from "./mock/declarations.json";
import type { IoDimensionCategory } from "./dimension";

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
		// every photo gets a category, so there has to be one to pick
		categories: z
			.record(
				z.string(),
				z.object({
					label: IoDeclarationLocalized,
					description: z.optional(IoDeclarationLocalized),
				}),
			)
			.refine((categories) => Object.keys(categories).length > 0, {
				message: "no categories",
			}),
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

/**
 * the declarations this client can render: unsupported or invalid ones
 * (e.g. a newer `type`) and repeated ids are skipped with a warning, so the
 * server can add declarations before the client supports them
 */
export const IoDeclarations = z.array(z.unknown()).transform((entries) => {
	const ids = new Set<string>();

	return entries.flatMap((entry, index) => {
		const result = IoDeclaration.safeParse(entry);
		if (!result.success) {
			console.warn(
				`skipping declaration at ${index}\n${z.prettifyError(result.error)}`,
			);
			return [];
		}
		if (ids.has(result.data.id)) {
			console.warn(`skipping repeated declaration <${result.data.id}>`);
			return [];
		}
		ids.add(result.data.id);

		return [result.data];
	});
});

// mocked until the endpoint is available
export const getDeclarations = () =>
	Promise.resolve({ declarations: IoDeclarations.parse(mock) });

export type IoResourceOption = { id: string; name: string; count: number };

const flattenCategories = (
	categories: Record<string, IoDimensionCategory>,
): IoResourceOption[] =>
	Object.entries(categories).flatMap(([id, { name, count, children }]) => [
		{ id, name, count },
		...flattenCategories(children),
	]);

// every option at once, served from the dimensions until dedicated endpoints
// exist (paginated like `/api/unstable/derived/devices`, filtered by `?term`)
export const getResourceOptions = async (
	resource: z.infer<typeof IoDeclarationPickerResource>,
	signal?: AbortSignal,
): Promise<IoResourceOption[]> => {
	const { dimensions } = await getDimensions({}, signal);

	switch (resource) {
		case "brand":
			return dimensions.manufacturers.map(({ name, count }) => ({
				id: name,
				name,
				count,
			}));
		case "category":
			return flattenCategories(dimensions.categories);
	}
};
