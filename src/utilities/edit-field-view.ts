import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { TemplateResult } from "lit";

import { m } from "../paraglide/messages.js";
import { localized } from "./localized";
import * as presentation from "./presentation";
import { iconSvg } from "./presentation/svg";
import type { Declaration, DeclarationPhotos } from "../types/declaration";

export type EditFieldViewInput = {
	declaration: Declaration;
	/** value from the server, empty means not set */
	value: string;
	/** display name of a resource value, e.g. a category name instead of its id */
	resourceLabel?: string | undefined;
	/** photos of a photos field, they aren't part of the device data yet */
	photos?: readonly EditFieldViewPhoto[] | undefined;
};

export type EditFieldViewPhoto = {
	src: string;
	alt: string;
	/** category id out of the declaration */
	category: string;
};

const unset = () =>
	html`<span class="edit-field-view-unset">${m.edit_field_unset()}</span>`;

const renderPhotos = (
	declaration: DeclarationPhotos,
	photos: readonly EditFieldViewPhoto[],
): TemplateResult => {
	if (photos.length === 0) {
		return unset();
	}

	return html`<ul class="edit-field-view-photos">
		${photos.map((photo) => {
			const category = declaration.categories[photo.category];
			return html`<li>
				<figure>
					<img src=${photo.src} alt=${photo.alt} />
					${
						typeof category !== "undefined"
							? html`<figcaption>${localized(category.label)}</figcaption>`
							: nothing
					}
				</figure>
			</li>`;
		})}
	</ul>`;
};

const renderValue = ({
	declaration,
	value,
	resourceLabel,
	photos = [],
}: EditFieldViewInput): TemplateResult => {
	if (declaration.type === "photos") {
		return renderPhotos(declaration, photos);
	}
	if (value === "") {
		return unset();
	}

	switch (declaration.type) {
		case "text":
			return html`<span
				class="edit-field-view-text ${declaration.pattern.kind === "ean" ? "is-code" : ""}"
				>${value}</span
			>`;
		case "toggle": {
			const labels: Record<string, string> = {
				true: m.edit_field_toggle_yes(),
				false: m.edit_field_toggle_no(),
			};
			return html`${labels[value] ?? value}`;
		}
		case "picker": {
			if (declaration.resource !== "none") {
				return html`${resourceLabel ?? value}`;
			}
			const option = declaration.options.find(({ id }) => id === value);
			if (typeof option === "undefined") {
				return html`${value}`;
			}

			return html`<span class="edit-field-view-option">
				${
					typeof option.icon !== "undefined"
						? html`<span class="edit-field-view-option-icon"
								>${unsafeHTML(
									iconSvg(presentation.declarationIcon(option.icon), 20),
								)}</span
							>`
						: nothing
				}
				<span class="edit-field-view-option-text">
					<span>${localized(option.title)}</span>
					${
						typeof option.subtitle !== "undefined"
							? html`<span class="edit-field-view-option-subtitle"
									>${localized(option.subtitle)}</span
								>`
							: nothing
					}
				</span>
			</span>`;
		}
	}
};

/**
 * read only field as a `<dt>` / `<dd>` pair, meant for a `<dl>`
 *
 * a lit template, islands render it as is, astro renders it to a string with
 * `renderToHtml` from `utilities/ssr.ts`, so it has to stay serializable:
 * no event listeners, property bindings or refs
 */
export const renderEditFieldView = (
	input: EditFieldViewInput,
): TemplateResult =>
	html`<div class="edit-field-view">
		<dt class="edit-field-view-label">${localized(input.declaration.label)}</dt>
		<dd class="edit-field-view-value">${renderValue(input)}</dd>
	</div>`;
