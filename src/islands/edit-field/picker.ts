import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { getResourceOptions } from "../../io/declaration";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { localized } from "../../utilities/localized.js";
import * as presentation from "../../utilities/presentation";
import { PresentationRenderPresetRoleIcon } from "../../utilities/presentation/preset.js";
import { rank } from "../../utilities/search.js";
import { renderRadioGroup, unsetAllowed } from "./radio-group";
import type { IoResourceOption } from "../../io/declaration";
import type {
	DeclarationPickerDynamic,
	DeclarationPickerResource,
	DeclarationPickerStatic,
} from "../../types/declaration";
import type { ComboboxSource } from "./combobox";
import type { EditFieldRenderContext } from "./context";
import type { RadioOption } from "./radio-group";

import "./combobox.js";

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

const PAGE_SIZE = 20;

// one source per resource, so re-renders don't hand the combobox a new object
const sources = new Map<DeclarationPickerResource, ComboboxSource>();
const resourceSource = (
	resource: DeclarationPickerResource,
): ComboboxSource => {
	let source = sources.get(resource);
	if (typeof source !== "undefined") {
		return source;
	}

	// fetched once and shared, typing only filters
	let all: Promise<IoResourceOption[]> | undefined;
	const options = () => {
		all ??= getResourceOptions(resource).catch((error: unknown) => {
			all = undefined;
			throw error;
		});
		return all;
	};

	source = {
		search: async (term) => {
			const ranked = rank(await options(), term, ({ name }) => name);
			return {
				options: ranked.slice(0, PAGE_SIZE).map(({ id, name, count }) => ({
					value: id,
					label: name,
					detail: m.edit_field_option_devices({
						count: count.toLocaleString(getLocale()),
					}),
				})),
				total: ranked.length,
			};
		},
		label: async (value) =>
			(await options()).find(({ id }) => id === value)?.name ?? value,
	};
	sources.set(resource, source);

	return source;
};

// options live on the server, so they're searched instead of listed
export const renderDynamicPicker = (
	ctx: EditFieldRenderContext<DeclarationPickerDynamic>,
) => {
	const { declaration, ids } = ctx;

	const onPick = (e: CustomEvent<string>) => {
		ctx.onInput(e.detail);
		ctx.onCommit();
	};

	return html`<edit-field-combobox
		.source=${resourceSource(declaration.resource)}
		.value=${ctx.value}
		.controlId=${ids.control}
		.labelId=${ids.label}
		.describedBy=${ctx.describedBy}
		.invalid=${ctx.invalid}
		.disabled=${ctx.disabled}
		.clearLabel=${
			unsetAllowed(declaration.allowUnset, ctx.defaultValue)
				? m.edit_field_clear({ label: localized(declaration.label) })
				: undefined
		}
		@combobox-pick=${onPick}
	></edit-field-combobox>`;
};
