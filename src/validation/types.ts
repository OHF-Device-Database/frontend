export type ValidationTextLength = {
	min?: number | undefined;
	max?: number | undefined;
};

export type ValidationTextPattern = {
	multiline: boolean;
	length?: ValidationTextLength | undefined;
} & (
	| {
			/** checked character by character against `regex`, a single character class */
			kind: "letter";
			regex: string;
	  }
	| { kind: "ean" }
);

export type ValidationPhotoSlot =
	{ constrained: true; categories: string[] } | { constrained: false };

/** `type` is the file's media type, `null` is an empty slot */
export type ValidationPhoto = { type: string; category: string } | null;

/** lengths and indices count code points, not UTF-16 code units */
export type ValidationIssue =
	| { code: "multiline" }
	| { code: "invalid-character"; index: number; character: string }
	| { code: "too-short"; min: number; length: number }
	| { code: "too-long"; max: number; length: number }
	| { code: "ean-length"; length: number }
	| { code: "ean-checksum" }
	| { code: "unknown-option" }
	| { code: "unset" }
	| { code: "photo-type"; slot: number }
	| { code: "photo-category"; slot: number };

export type ValidationIssueCode = ValidationIssue["code"];
