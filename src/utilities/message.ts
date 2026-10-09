import type { MessagePart } from "../paraglide/runtime.js";

/** a compiled message containing markup, e.g. `Read {#link}more{/link}` */
export type MarkupMessage = ((inputs: never, options?: never) => string) & {
	parts: (inputs: never, options?: never) => MessagePart[];
	readonly __paraglide?: { markup: Record<string, unknown> };
};

export type MessageInputs<M extends MarkupMessage> = Parameters<M>[0];

export type MessageMarkup<M extends MarkupMessage> = Record<
	keyof NonNullable<M["__paraglide"]>["markup"],
	(children: unknown[]) => unknown
>;

export type MessageNode = string | { name: string; children: MessageNode[] };

/** turns the flat parts of a message into a tree, so markup can wrap its children */
export const nest = (parts: MessagePart[]): MessageNode[] => {
	const root: MessageNode[] = [];
	const stack = [root];
	for (const part of parts) {
		const top = stack.at(-1) ?? root;
		switch (part.type) {
			case "text":
				top.push(part.value);
				break;
			case "markup-standalone":
				top.push({ name: part.name, children: [] });
				break;
			case "markup-start": {
				const node = { name: part.name, children: [] };
				top.push(node);
				stack.push(node.children);
				break;
			}
			case "markup-end":
				if (stack.length > 1) {
					stack.pop();
				}
				break;
		}
	}
	return root;
};

/**
 * renders a message, wrapping each markup tag with its renderer
 * text stays a plain string, so templating escapes it as usual
 *
 * @example
 * html`${renderMessage(m.about_read, {}, {
 * 	link: (children) => html`<a href="/how-it-works">${children}</a>`,
 * })}`
 */
export const renderMessage = <M extends MarkupMessage>(
	message: M,
	inputs: MessageInputs<M>,
	markup: MessageMarkup<M>,
): unknown[] => {
	const renderers: Partial<Record<string, (children: unknown[]) => unknown>> =
		markup;
	const render = (nodes: MessageNode[]): unknown[] =>
		nodes.flatMap((node) => {
			if (typeof node === "string") {
				return node;
			}
			const children = render(node.children);
			return renderers[node.name]?.(children) ?? children;
		});
	return render(nest(message.parts(inputs)));
};
