import type { ValidationIssue } from "./types";

const EAN_LENGTHS = new Set([8, 13]);
const DIGIT = /^\d$/;

/** GS1 mod 10, weights alternate 3, 1, … starting next to the check digit */
const checkDigit = (payload: string[]): number => {
	const sum = payload
		.toReversed()
		.reduce(
			(acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 3 : 1),
			0,
		);

	return (10 - (sum % 10)) % 10;
};

/** expects code points, see `validateText` */
export const validateEan = (characters: string[]): ValidationIssue[] => {
	for (const [index, character] of characters.entries()) {
		if (!DIGIT.test(character)) {
			return [{ code: "invalid-character", index, character }];
		}
	}

	if (!EAN_LENGTHS.has(characters.length)) {
		return [{ code: "ean-length", length: characters.length }];
	}

	const payload = characters.slice(0, -1);
	if (checkDigit(payload) !== Number(characters.at(-1))) {
		return [{ code: "ean-checksum" }];
	}

	return [];
};
