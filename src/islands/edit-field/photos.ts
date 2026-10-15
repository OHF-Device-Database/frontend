import { html, nothing } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";

import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { localized } from "../../utilities/localized.js";
import type { DeclarationPhotos } from "../../types/declaration";
import type { EditFieldRenderContext } from "./context";

/** `null` is an empty slot, `preview` is an object url */
export type PhotoSlotValue = {
	file: File;
	category: string;
	preview: string;
} | null;

export const emptyPhotos = (declaration: DeclarationPhotos): PhotoSlotValue[] =>
	declaration.pattern.slots.map(() => null);

export const releasePhotos = (photos: PhotoSlotValue[]): void => {
	for (const photo of photos) {
		if (photo !== null) {
			URL.revokeObjectURL(photo.preview);
		}
	}
};

/** one entry per file and one for its category, e.g. `photos.0` and `photos.0.category` */
export const photosFormData = (
	name: string,
	photos: PhotoSlotValue[],
): FormData => {
	const data = new FormData();
	for (const [index, photo] of photos.entries()) {
		if (photo !== null) {
			data.append(`${name}.${index}`, photo.file);
			data.append(`${name}.${index}.category`, photo.category);
		}
	}

	return data;
};

export const renderPhotos = (
	ctx: EditFieldRenderContext<DeclarationPhotos>,
	photos: PhotoSlotValue[],
	onPhotos: (photos: PhotoSlotValue[]) => void,
) => {
	const { declaration, ids, describedBy, invalid, disabled } = ctx;
	const or = new Intl.ListFormat(getLocale(), { type: "disjunction" });
	const categoryLabel = (id: string) => {
		const category = declaration.categories[id];
		return typeof category !== "undefined" ? localized(category.label) : id;
	};

	/** `commit` shows issues, skipped while a category still has to be chosen */
	const set = (index: number, photo: PhotoSlotValue, commit = true) => {
		const previous = photos[index] ?? null;
		if (previous !== null && previous.preview !== photo?.preview) {
			releasePhotos([previous]);
		}
		onPhotos(photos.map((current, at) => (at === index ? photo : current)));
		if (commit) {
			ctx.onCommit();
		}
	};

	return html`
		<div
			class="edit-field-photos"
			id=${ids.control}
			role="group"
			aria-labelledby=${ids.label}
			aria-describedby=${ifDefined(describedBy)}
			aria-invalid=${invalid ? "true" : nothing}
		>
			${declaration.pattern.slots.map((slot, index) => {
				const photo = photos[index] ?? null;
				const categories = slot.constrained
					? slot.categories
					: Object.keys(declaration.categories);
				const number = index + 1;
				const titleId = `${ids.control}-${index}-title`;

				const onFile = (e: Event) => {
					const file = (e.currentTarget as HTMLInputElement).files?.[0];
					if (typeof file !== "undefined") {
						// a single allowed category needs no choice
						const category =
							categories.length === 1 ? (categories[0] ?? "") : "";
						set(
							index,
							{ file, category, preview: URL.createObjectURL(file) },
							category !== "",
						);
					}
				};

				return html`
					<section class="edit-field-photo" aria-labelledby=${titleId}>
						<p class="edit-field-photo-title" id=${titleId}>
							${m.edit_field_photo_slot({ number })}
							<span>
								${
									slot.constrained
										? or.format(categories.map(categoryLabel))
										: m.edit_field_photo_any()
								}
							</span>
						</p>
						${
							photo === null
								? html`<input
										type="file"
										accept="image/*"
										aria-labelledby=${titleId}
										?disabled=${disabled}
										@change=${onFile}
									/>`
								: html`
										<img src=${photo.preview} alt=${photo.file.name} />
										${
											categories.length > 1
												? html`<select
														aria-label=${m.edit_field_photo_category({ number })}
														?disabled=${disabled}
														@change=${(e: Event) =>
															set(index, {
																...photo,
																category: (e.currentTarget as HTMLSelectElement)
																	.value,
															})}
													>
														<option
															value=""
															disabled
															?selected=${photo.category === ""}
														>
															${m.edit_field_photo_choose_category()}
														</option>
														${categories.map(
															(id) =>
																html`<option
																	value=${id}
																	?selected=${photo.category === id}
																>
																	${categoryLabel(id)}
																</option>`,
														)}
													</select>`
												: nothing
										}
										<button
											type="button"
											class="btn btn-secondary"
											aria-label=${m.edit_field_photo_remove({ number })}
											?disabled=${disabled}
											@click=${(e: Event) => {
												set(index, null);
												// not a native edit, so fire what a native control would
												e.currentTarget?.dispatchEvent(
													new Event("change", { bubbles: true }),
												);
											}}
										>
											${m.edit_field_photo_remove_short()}
										</button>
									`
						}
					</section>
				`;
			})}
		</div>
	`;
};
