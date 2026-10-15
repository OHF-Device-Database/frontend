import { m } from "../../paraglide/messages.js";
import { unsetAllowed } from "../../validation";
import { renderRadioGroup } from "./radio-group";
import type { DeclarationToggle } from "../../types/declaration";
import type { EditFieldRenderContext } from "./context";

/** submitted values, empty means not set like for every other type */
export const TOGGLE_VALUES = new Set(["true", "false", ""]);

export const renderToggle = (
	ctx: EditFieldRenderContext<DeclarationToggle>,
) => {
	const options = [
		{ value: "true", content: m.edit_field_toggle_yes() },
		{ value: "false", content: m.edit_field_toggle_no() },
	];
	if (unsetAllowed(ctx.declaration.allowUnset, ctx.defaultValue)) {
		options.push({ value: "", content: m.edit_field_unset() });
	}

	return renderRadioGroup(ctx, "edit-field-toggle", options);
};
