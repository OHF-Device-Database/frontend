import type { ValidationIssue } from "./types";

/** empty values are valid, as fields are optional */
export const validateOption = (
	value: string,
	ids: ReadonlySet<string>,
): ValidationIssue[] =>
	value === "" || ids.has(value) ? [] : [{ code: "unknown-option" }];
