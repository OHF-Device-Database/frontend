import { describe, test } from "vitest";

import { renderEditFieldView } from "../src/utilities/edit-field-view";
import { markup, toHtml, trusted } from "../src/utilities/markup";
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

const view = (
	declaration: Declaration,
	value: string,
	resourceLabel?: string,
) => toHtml(renderEditFieldView({ declaration, value, resourceLabel }));

describe("markup", () => {
	test("escapes interpolated text", (t) => {
		t.expect(toHtml(markup`<p>${`<b title="x">&'`}</p>`)).toBe(
			"<p>&lt;b title=&quot;x&quot;&gt;&amp;&#39;</p>",
		);
	});

	test("keeps nested and trusted markup, skips empty values", (t) => {
		const items = ["a", "<b>"].map((item) => markup`<li>${item}</li>`);
		t.expect(
			toHtml(markup`<ul>${items}${false}${undefined}${trusted("<hr>")}</ul>`),
		).toBe("<ul><li>a</li><li>&lt;b&gt;</li><hr></ul>");
	});
});

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
