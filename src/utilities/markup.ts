// html as a plain string, for markup that has to render on the server
// (astro `set:html`) and in islands (lit `unsafeHTML`) alike

const MarkupSymbol = Symbol("Markup");

/** html whose interpolated values were escaped, safe to inject */
export type Markup = { readonly [MarkupSymbol]: string };

export type MarkupValue =
	Markup | string | number | false | null | undefined | MarkupValue[];

const ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

const escape = (text: string): string =>
	text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);

const isMarkup = (value: unknown): value is Markup =>
	typeof value === "object" && value !== null && MarkupSymbol in value;

const serialize = (value: MarkupValue): string => {
	if (isMarkup(value)) {
		return value[MarkupSymbol];
	}
	if (Array.isArray(value)) {
		return value.map(serialize).join("");
	}
	if (value === false || value === null || typeof value === "undefined") {
		return "";
	}

	return escape(String(value));
};

/** like lit's `html`: strings and numbers are escaped, nested markup is kept */
export const markup = (
	strings: TemplateStringsArray,
	...values: MarkupValue[]
): Markup => ({
	[MarkupSymbol]: strings.reduce(
		(out, string, index) => out + serialize(values[index - 1]) + string,
	),
});

/** html that is already safe, e.g. an svg rendered from the icon set */
export const trusted = (html: string): Markup => ({ [MarkupSymbol]: html });

export const toHtml = (value: Markup): string => value[MarkupSymbol];
