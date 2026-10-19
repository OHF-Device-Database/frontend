import { m } from "../../paraglide/messages.js";
import { renderRadioGroup } from "./radio-group";
import type { DeclarationToggle } from "../../types/declaration";
import type { EditFieldRenderContext } from "./context";

/** empty means not set, it's never submitted since it can't be picked */
export const TOGGLE_VALUES = new Set(["true", "false", ""]);

// without a value neither is checked, like native radios
export const renderToggle = (ctx: EditFieldRenderContext<DeclarationToggle>) =>
	renderRadioGroup(ctx, "edit-field-toggle", [
		{ value: "true", content: m.edit_field_toggle_yes() },
		{ value: "false", content: m.edit_field_toggle_no() },
	]);
