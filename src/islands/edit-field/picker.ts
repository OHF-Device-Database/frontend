import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { m } from "../../paraglide/messages.js";
import { localized } from "../../utilities/localized.js";
import * as presentation from "../../utilities/presentation";
import { PresentationRenderPresetRoleIcon } from "../../utilities/presentation/preset.js";
import { renderRadioGroup, unsetAllowed } from "./radio-group";
import type { DeclarationPickerStatic } from "../../types/declaration";
import type { EditFieldRenderContext } from "./context";
import type { RadioOption } from "./radio-group";

/** submitted values, empty means not set */
export const pickerValues = (declaration: DeclarationPickerStatic) =>
	new Set(["", ...declaration.options.map(({ id }) => id)]);

// few static options read better all at once than behind a combobox
export const renderStaticPicker = (
	ctx: EditFieldRenderContext<DeclarationPickerStatic>,
) => {
	const { declaration, ids } = ctx;

	const options: RadioOption[] = declaration.options.map((option, index) => {
		const titleId = `${ids.control}-${index}-title`;
		const subtitleId = `${ids.control}-${index}-subtitle`;

		return {
			value: option.id,
			labelledBy: titleId,
			describedBy:
				typeof option.subtitle !== "undefined" ? subtitleId : undefined,
			content: html`
				${
					typeof option.icon !== "undefined"
						? html`<span class="edit-field-option-icon">
								${unsafeHTML(
									presentation.render(
										presentation.declarationIcon(option.icon),
										PresentationRenderPresetRoleIcon.withSize(20),
									),
								)}
							</span>`
						: nothing
				}
				<span class="edit-field-option-text">
					<span class="edit-field-option-title" id=${titleId}>
						${localized(option.title)}
					</span>
					${
						typeof option.subtitle !== "undefined"
							? html`<span class="edit-field-option-subtitle" id=${subtitleId}>
									${localized(option.subtitle)}
								</span>`
							: nothing
					}
				</span>
			`,
		};
	});

	if (unsetAllowed(declaration.allowUnset, ctx.defaultValue)) {
		options.push({
			value: "",
			content: html`<span class="edit-field-option-text">
				<span class="edit-field-option-title">${m.edit_field_unset()}</span>
			</span>`,
		});
	}

	return renderRadioGroup(ctx, "edit-field-options", options);
};
