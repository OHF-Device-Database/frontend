import type { ValidationIssue } from "./types";

/** a value can stay empty, but a value that was set can't be removed */
export const validateUnset = (
	value: string,
	defaultValue: string,
): ValidationIssue[] =>
	value === "" && defaultValue !== "" ? [{ code: "unset" }] : [];
