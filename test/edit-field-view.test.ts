import { describe, test } from "vitest";
import type { TemplateResult } from "lit";

import { renderEditFieldView } from "../src/utilities/edit-field-view";
import { renderToHtml } from "../src/utilities/ssr";
import type { Declaration } from "../src/types/declaration";

const text: Declaration = {
	id: "name",
	type: "text",
	label: { en: "Name" },
	pattern: { multiline: false, kind: "letter", regex: "\\p{L}" },
};

const toggle: Declaration = {
	id: "light.dimming",
	type: "toggle",
	label: { en: "Dimmable" },
};

const picker: Declaration = {
	id: "local-operation",
	type: "picker",
	label: { en: "Local Operation" },
	resource: "none",
	options: [
		{ id: "local", title: { en: "Fully Local" }, icon: "sun" },
		{ id: "cloud", title: { en: "Cloud Required" } },
	],
};

// without lit's hydration comments, to assert on the markup itself
const toHtml = (template: TemplateResult) =>
	renderToHtml(template).replaceAll(/<!--\/?lit-[^>]*-->/g, "");

const view = (
	declaration: Declaration,
	value: string,
	resourceLabel?: string,
) => toHtml(renderEditFieldView({ declaration, value, resourceLabel }));

describe("renderEditFieldView", () => {
	test("pairs the label with the value", (t) => {
		const html = view(text, "Hue <White>");
		t.expect(html).toContain('<dt class="edit-field-view-label">Name</dt>');
		t.expect(html).toContain("Hue &lt;White&gt;");
	});

	test("shows not set for empty values and photos", (t) => {
		t.expect(view(text, "")).toContain("Not set");
		t.expect(view(toggle, "")).toContain("Not set");
	});

	test("labels toggle values", (t) => {
		t.expect(view(toggle, "true")).toContain(">Yes</dd>");
		t.expect(view(toggle, "false")).toContain(">No</dd>");
		t.expect(view(toggle, "maybe")).toContain(">maybe</dd>");
	});

	test("shows the picked option, or the raw value if it's unknown", (t) => {
		const local = view(picker, "local");
		t.expect(local).toContain("Fully Local");
		t.expect(local).toContain("<svg");
		t.expect(view(picker, "cloud")).not.toContain("<svg");
		t.expect(view(picker, "gone")).toContain(">gone</dd>");
	});

	test("lists photos with their category", (t) => {
		const photos: Declaration = {
			id: "photos",
			type: "photos",
			label: { en: "Photos" },
			categories: { packshot: { label: { en: "Packshot" } } },
			pattern: { slots: [{ constrained: false }] },
		};
		t.expect(view(photos, "")).toContain("Not set");
		const html = toHtml(
			renderEditFieldView({
				declaration: photos,
				value: "",
				photos: [{ src: "a.png", alt: 'say "hi"', category: "packshot" }],
			}),
		);
		t.expect(html).toContain('<img src="a.png" alt="say &quot;hi&quot;" />');
		t.expect(html).toContain("<figcaption>Packshot</figcaption>");
	});

	test("prefers the resolved label of a resource value", (t) => {
		const category: Declaration = {
			id: "category",
			type: "picker",
			label: { en: "Category" },
			resource: "category",
		};
		t.expect(view(category, "lighting", "Lighting")).toContain(
			">Lighting</dd>",
		);
		t.expect(view(category, "lighting")).toContain(">lighting</dd>");
	});
});
