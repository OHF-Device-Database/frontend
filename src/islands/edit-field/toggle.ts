import { html, nothing } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { live } from "lit/directives/live.js";

import { m } from "../../paraglide/messages.js";
import type { DeclarationToggle } from "../../types/declaration";
import type { EditFieldRenderContext } from "./context";

/** submitted values, empty means not set like for every other type */
export const TOGGLE_VALUES = new Set(["true", "false", ""]);

const OPTIONS = [
	{ value: "true", label: m.edit_field_toggle_yes },
	{ value: "false", label: m.edit_field_toggle_no },
	{ value: "", label: m.edit_field_toggle_unset },
] as const;

export const renderToggle = (
	ctx: EditFieldRenderContext<DeclarationToggle>,
) => {
	const {
		declaration,
		value,
		defaultValue,
		ids,
		describedBy,
		invalid,
		disabled,
	} = ctx;
	// without `allowUnset`, "not set" only shows when the device has no value yet
	const options = OPTIONS.filter(
		(option) =>
			option.value !== "" ||
			declaration.allowUnset !== false ||
			defaultValue === "",
	);

	const onChange = (e: Event) => {
		ctx.onInput((e.currentTarget as HTMLInputElement).value);
		ctx.onCommit();
	};

	// radios need a shared `name` to group, pointing `form` at the control id
	// leaves them without a form owner, so only the host gets submitted
	return html`
		<div
			class="edit-field-toggle"
			id=${ids.control}
			role="radiogroup"
			aria-labelledby=${ids.label}
			aria-describedby=${ifDefined(describedBy)}
			aria-invalid=${invalid ? "true" : nothing}
		>
			${options.map(
				(option) => html`
					<label>
						<input
							type="radio"
							name=${ids.control}
							form=${ids.control}
							value=${option.value}
							.checked=${live(value === option.value)}
							?disabled=${disabled}
							@change=${onChange}
						/>
						${option.label()}
					</label>
				`,
			)}
		</div>
	`;
};
