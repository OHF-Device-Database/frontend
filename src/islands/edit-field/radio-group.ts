import { html, nothing } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { live } from "lit/directives/live.js";
import type { TemplateResult } from "lit";

import type { Declaration } from "../../types/declaration";
import type { EditFieldRenderContext } from "./context";

export type RadioOption = {
	value: string;
	content: TemplateResult | string;
	/** names the radio when `content` holds more than its name */
	labelledBy?: string | undefined;
	describedBy?: string | undefined;
};

/** without `allowUnset`, "not set" only shows when the device has no value yet */
export const unsetAllowed = (
	allowUnset: boolean | undefined,
	defaultValue: string,
): boolean => allowUnset !== false || defaultValue === "";

export const renderRadioGroup = (
	ctx: EditFieldRenderContext<Declaration>,
	className: string,
	options: RadioOption[],
) => {
	const { value, ids, describedBy, invalid, disabled } = ctx;

	const onChange = (e: Event) => {
		ctx.onInput((e.currentTarget as HTMLInputElement).value);
		ctx.onCommit();
	};

	// radios need a shared `name` to group, pointing `form` at the control id
	// leaves them without a form owner, so only the host gets submitted
	return html`
		<div
			class=${className}
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
							aria-labelledby=${ifDefined(option.labelledBy)}
							aria-describedby=${ifDefined(option.describedBy)}
							?disabled=${disabled}
							@change=${onChange}
						/>
						${option.content}
					</label>
				`,
			)}
		</div>
	`;
};
