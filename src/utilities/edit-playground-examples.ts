import type { Declaration } from "../types/declaration";

// shared by the playground island and its server rendered views

// variants the mocked declarations don't cover
export const EXTRA_EXAMPLES: Declaration[] = [
	{
		id: "notes",
		type: "text",
		label: { en: "Notes" },
		hint: { en: "Anything else worth knowing about the device" },
		pattern: {
			multiline: true,
			length: { max: 500 },
			kind: "letter",
			regex: "[\\p{L}\\p{M}\\p{N}\\p{P}\\p{Zs}\\p{Sc}\\p{Sm}]",
		},
	},
	{
		id: "battery-powered",
		type: "toggle",
		label: { en: "Battery powered" },
		hint: { en: "Runs on batteries" },
	},
];

export const EXAMPLE_VALUES: Record<string, string> = {
	name: "Hue White A19",
	ean: "4006381333931",
	"light.dimming": "true",
	"local-operation": "cloud-ish",
	brand: "Philips",
	category: "lighting",
};
