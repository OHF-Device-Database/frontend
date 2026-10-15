import type { ValidationIssue } from "./types";

/** empty values are valid, as fields are optional */
export const validateOption = (
	value: string,
	ids: ReadonlySet<string>,
): ValidationIssue[] =>
	value === "" || ids.has(value) ? [] : [{ code: "unknown-option" }];

/** without `allowUnset`, a value can only stay empty when it was empty before */
export const unsetAllowed = (
	allowUnset: boolean | undefined,
	defaultValue: string,
): boolean => allowUnset !== false || defaultValue === "";

export const validateUnset = (
	value: string,
	allowed: boolean,
): ValidationIssue[] => (value === "" && !allowed ? [{ code: "unset" }] : []);
