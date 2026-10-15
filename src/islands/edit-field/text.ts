import { html, nothing } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { live } from "lit/directives/live.js";

import { icon } from "../../utilities/presentation/icon.js";
import type { DeclarationText } from "../../types/declaration";
import type { EditFieldRenderContext } from "./context";

// presentation is keyed by declaration id, it is not part of the declaration
const PREFIX_ICON: Partial<Record<string, Parameters<typeof icon>[0]>> = {
	ean: "barcode",
};

export const renderText = (ctx: EditFieldRenderContext<DeclarationText>) => {
	const { declaration, value, ids, describedBy, invalid, disabled } = ctx;
	const { pattern } = declaration;
	const max = pattern.length?.max;
	const prefix = PREFIX_ICON[declaration.id];
	const numeric = pattern.kind === "ean";

	const onInput = (e: Event) => {
		ctx.onInput(
			(e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value,
		);
	};

	// no `name` and no constraint attributes: the host submits and validates
	const control = pattern.multiline
		? html`<textarea
				id=${ids.control}
				rows="3"
				.value=${live(value)}
				aria-describedby=${ifDefined(describedBy)}
				aria-invalid=${invalid ? "true" : nothing}
				?disabled=${disabled}
				@input=${onInput}
				@change=${ctx.onCommit}
			></textarea>`
		: html`<input
				type="text"
				id=${ids.control}
				.value=${live(value)}
				inputmode=${numeric ? "numeric" : nothing}
				spellcheck=${numeric ? "false" : nothing}
				autocomplete="off"
				aria-describedby=${ifDefined(describedBy)}
				aria-invalid=${invalid ? "true" : nothing}
				?disabled=${disabled}
				@input=${onInput}
				@change=${ctx.onCommit}
			/>`;

	return html`
		<div class="edit-field-control">
			${
				typeof prefix !== "undefined"
					? html`<span class="edit-field-prefix">${icon(prefix)}</span>`
					: nothing
			}
			${control}
			${
				typeof max !== "undefined"
					? html`<span class="edit-field-counter" aria-hidden="true">
							${[...value].length}/${max}
						</span>`
					: nothing
			}
		</div>
	`;
};
