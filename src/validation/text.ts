import { validateEan } from "./ean";
import type { ValidationIssue, ValidationTextPattern } from "./types";

const LINE_BREAK = /[\n\r]/;

type CharacterClass = {
	/** cheap check whether any character is invalid, line breaks are left to `multiline` */
	whole: RegExp;
	/** pinpoints the invalid character once `whole` fails */
	single: RegExp;
};

// validation runs on every keystroke, so compile each character class once
const compiled = new Map<string, CharacterClass>();
const characterClass = (source: string): CharacterClass => {
	let cached = compiled.get(source);
	if (typeof cached === "undefined") {
		cached = {
			whole: new RegExp(`^(?:${source}|[\\n\\r])*$`, "u"),
			single: new RegExp(`^(?:${source})$`, "u"),
		};
		compiled.set(source, cached);
	}

	return cached;
};

const invalidCharacter = (
	value: string,
	characters: string[],
	source: string,
): ValidationIssue | undefined => {
	const { whole, single } = characterClass(source);
	if (whole.test(value)) {
		return undefined;
	}

	for (const [index, character] of characters.entries()) {
		if (!LINE_BREAK.test(character) && !single.test(character)) {
			return { code: "invalid-character", index, character };
		}
	}

	return undefined;
};

/**
 * empty values are valid, as fields are optional
 * issues are ordered by relevance, consumers usually show the first one
 */
export const validateText = (
	value: string,
	pattern: ValidationTextPattern,
): ValidationIssue[] => {
	if (value === "") {
		return [];
	}

	// code points, so that an emoji counts as one character
	const characters = [...value];
	const issues: ValidationIssue[] = [];

	if (!pattern.multiline && LINE_BREAK.test(value)) {
		issues.push({ code: "multiline" });
	}

	switch (pattern.kind) {
		case "letter": {
			const issue = invalidCharacter(value, characters, pattern.regex);
			if (typeof issue !== "undefined") {
				issues.push(issue);
			}
			break;
		}
		case "ean":
			issues.push(...validateEan(characters));
			break;
	}

	const { min, max } = pattern.length ?? {};
	if (typeof min !== "undefined" && characters.length < min) {
		issues.push({ code: "too-short", min, length: characters.length });
	}
	if (typeof max !== "undefined" && characters.length > max) {
		issues.push({ code: "too-long", max, length: characters.length });
	}

	return issues;
};
