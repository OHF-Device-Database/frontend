import { test } from "vitest";

import { nest, renderMessage } from "../src/utilities/message";
import type { MessagePart } from "../src/paraglide/runtime.js";

const start = (name: string): MessagePart => ({
	type: "markup-start",
	name,
	options: {},
	attributes: {},
});
const end = (name: string): MessagePart => ({
	type: "markup-end",
	name,
	options: {},
	attributes: {},
});

const parts: MessagePart[] = [
	{ type: "text", value: "Read " },
	start("link"),
	{ type: "text", value: "how " },
	start("strong"),
	{ type: "text", value: "it" },
	end("strong"),
	end("link"),
	{ type: "text", value: " works" },
];

const message = Object.assign(() => "", { parts: () => parts });

test("nests markup children", (t) => {
	t.expect(nest(parts)).toEqual([
		"Read ",
		{
			name: "link",
			children: ["how ", { name: "strong", children: ["it"] }],
		},
		" works",
	]);
});

test("wraps children with their renderer", (t) => {
	t.expect(
		renderMessage(message, undefined as never, {
			link: (children) => ["<a>", ...children, "</a>"],
			strong: (children) => ["<b>", ...children, "</b>"],
		}).join(""),
	).toBe("Read <a>how <b>it</b></a> works");
});

test("keeps the text of tags without a renderer", (t) => {
	t.expect(
		renderMessage(message, undefined as never, {} as never).join(""),
	).toBe("Read how it works");
});
