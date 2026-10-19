import { m } from "../paraglide/messages.js";
import { localized } from "./localized";
import { markup, trusted } from "./markup";
import * as presentation from "./presentation";
import { iconSvg } from "./presentation/svg";
import type { Declaration } from "../types/declaration";
import type { Markup } from "./markup";

export type EditFieldViewInput = {
	declaration: Declaration;
	/** value from the server, empty means not set */
	value: string;
	/** display name of a resource value, e.g. a category name instead of its id */
	resourceLabel?: string | undefined;
};

const unset = () =>
	markup`<span class="edit-field-view-unset">${m.edit_field_unset()}</span>`;

const renderValue = ({
	declaration,
	value,
	resourceLabel,
}: EditFieldViewInput): Markup => {
	// existing photos aren't part of the device data yet
	if (value === "" || declaration.type === "photos") {
		return unset();
	}

	switch (declaration.type) {
		case "text":
			return markup`<span
				class="edit-field-view-text ${declaration.pattern.kind === "ean" ? "is-code" : ""}"
			>${value}</span>`;
		case "toggle": {
			const labels: Record<string, string> = {
				true: m.edit_field_toggle_yes(),
				false: m.edit_field_toggle_no(),
			};
			return markup`${labels[value] ?? value}`;
		}
		case "picker": {
			if (declaration.resource !== "none") {
				return markup`${resourceLabel ?? value}`;
			}
			const option = declaration.options.find(({ id }) => id === value);
			if (typeof option === "undefined") {
				return markup`${value}`;
			}

			return markup`<span class="edit-field-view-option">
				${
					typeof option.icon !== "undefined"
						? markup`<span class="edit-field-view-option-icon">${trusted(
								iconSvg(presentation.declarationIcon(option.icon), 20),
							)}</span>`
						: false
				}
				<span class="edit-field-view-option-text">
					<span>${localized(option.title)}</span>
					${
						typeof option.subtitle !== "undefined"
							? markup`<span class="edit-field-view-option-subtitle">${localized(
									option.subtitle,
								)}</span>`
							: false
					}
				</span>
			</span>`;
		}
	}
};

/**
 * read only field as a `<dt>` / `<dd>` pair, meant for a `<dl>`
 *
 * a plain string, so it renders on the server without javascript:
 * `<dl><Fragment set:html={toHtml(renderEditFieldView(input))} /></dl>` in astro,
 * `unsafeHTML(toHtml(...))` in an island
 */
export const renderEditFieldView = (input: EditFieldViewInput): Markup =>
	markup`<div class="edit-field-view">
		<dt class="edit-field-view-label">${localized(input.declaration.label)}</dt>
		<dd class="edit-field-view-value">${renderValue(input)}</dd>
	</div>`;
