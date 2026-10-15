import { m } from "../../paraglide/messages.js";
import type { ValidationIssue } from "../../validation";

const VISIBLE = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u;

// whitespace and control characters are invisible when quoted
const displayCharacter = (character: string): string => {
	if (VISIBLE.test(character)) {
		return `“${character}”`;
	}
	const codePoint = character.codePointAt(0) ?? 0;

	return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
};

export const issueMessage = (issue: ValidationIssue): string => {
	switch (issue.code) {
		case "multiline":
			return m.edit_field_issue_multiline();
		case "invalid-character":
			return m.edit_field_issue_invalid_character({
				character: displayCharacter(issue.character),
				position: issue.index + 1,
			});
		case "too-short":
			return m.edit_field_issue_too_short(issue);
		case "too-long":
			return m.edit_field_issue_too_long(issue);
		case "ean-length":
			return m.edit_field_issue_ean_length(issue);
		case "ean-checksum":
			return m.edit_field_issue_ean_checksum();
		case "unknown-option":
			return m.edit_field_issue_unknown_option();
		case "photo-type":
			return m.edit_field_issue_photo_type({ number: issue.slot + 1 });
		case "photo-category":
			return m.edit_field_issue_photo_category({ number: issue.slot + 1 });
	}
};
