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

/** lengths and indices count code points, not UTF-16 code units */
export type ValidationIssue =
	| { code: "multiline" }
	| { code: "invalid-character"; index: number; character: string }
	| { code: "too-short"; min: number; length: number }
	| { code: "too-long"; max: number; length: number }
	| { code: "ean-length"; length: number }
	| { code: "ean-checksum" }
	| { code: "unknown-option" };

export type ValidationIssueCode = ValidationIssue["code"];
