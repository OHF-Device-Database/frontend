import type { Declaration } from "../../types/declaration";

export type EditFieldIds = {
	label: string;
	control: string;
	hint: string;
	description: string;
	error: string;
};

/** everything a type specific control needs, the host owns state and form integration */
export type EditFieldRenderContext<D extends Declaration> = {
	declaration: D;
	value: string;
	/** value from the server, before any edit */
	defaultValue: string;
	ids: EditFieldIds;
	describedBy: string | undefined;
	invalid: boolean;
	disabled: boolean;
	onInput: (value: string) => void;
	/** user finished an edit, mirrors the native `change` event */
	onCommit: () => void;
};
