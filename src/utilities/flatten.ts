import { isTemplateResult, TemplateResultType } from "lit/directive-helpers.js";

/** flattens lit templates to string, useful when slotting templates into translation parameters */
export const flatten = (value: unknown): string => {
	if (isTemplateResult(value, TemplateResultType.HTML)) {
		const { strings, values } = value;
		return strings.reduce((acc, str, i) => {
			const v = i < values.length ? flatten(values[i]) : "";
			return acc + str + v;
		}, "");
	}
	if (Array.isArray(value)) {
		return value.map(flatten).join("");
	}
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	return "";
};
