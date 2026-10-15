import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { PropertyValues } from "lit";

import "../styles/edit-field.css";

import { m } from "../paraglide/messages.js";
import { defineElementOnce } from "../utilities/define-element.js";
import { localized } from "../utilities/localized.js";
import * as presentation from "../utilities/presentation";
import { PresentationRenderPresetRoleIcon } from "../utilities/presentation/preset.js";
import {
	unsetAllowed,
	validateOption,
	validatePhotos,
	validateText,
	validateUnset,
} from "../validation";
import { issueMessage } from "./edit-field/issue.js";
import {
	emptyPhotos,
	photosFormData,
	releasePhotos,
	renderPhotos,
} from "./edit-field/photos.js";
import {
	pickerValues,
	renderDynamicPicker,
	renderStaticPicker,
} from "./edit-field/picker.js";
import { renderText } from "./edit-field/text.js";
import { renderToggle, TOGGLE_VALUES } from "./edit-field/toggle.js";
import type { Declaration } from "../types/declaration";
import type { ValidationIssue } from "../validation";
import type {
	EditFieldIds,
	EditFieldRenderContext,
} from "./edit-field/context.js";
import type { PhotoSlotValue } from "./edit-field/photos.js";

// light DOM, so ids have to be unique across the document
let instances = 0;
const editFieldIds = (): EditFieldIds => {
	const prefix = `edit-field-${instances++}`;
	return {
		label: `${prefix}-label`,
		control: `${prefix}-control`,
		hint: `${prefix}-hint`,
		description: `${prefix}-description`,
		error: `${prefix}-error`,
	};
};

const validate = (
	declaration: Declaration,
	value: string,
	defaultValue: string,
	photos: PhotoSlotValue[],
): ValidationIssue[] => {
	switch (declaration.type) {
		case "text":
			return validateText(value, declaration.pattern);
		case "toggle":
			return [
				...validateUnset(
					value,
					unsetAllowed(declaration.allowUnset, defaultValue),
				),
				...validateOption(value, TOGGLE_VALUES),
			];
		case "picker":
			return [
				...validateUnset(
					value,
					unsetAllowed(declaration.allowUnset, defaultValue),
				),
				...(declaration.resource === "none"
					? validateOption(value, pickerValues(declaration))
					: []),
			];
		case "photos":
			return validatePhotos(
				photos.map(
					(photo) =>
						photo && { type: photo.file.type, category: photo.category },
				),
				declaration.pattern.slots,
			);
	}
};

const icon = (name: Parameters<typeof presentation.generic>[0]) =>
	unsafeHTML(
		presentation.render(
			presentation.generic(name),
			PresentationRenderPresetRoleIcon.withSize(16),
		),
	);

/**
 * form-associated control rendered from a declaration
 *
 * mirrors native inputs: the `value` attribute is the initial value
 * (`defaultValue`), the `value` property is the current one
 */
export class EditField extends LitElement {
	static formAssociated = true;

	@property({ attribute: false }) declaration: Declaration | undefined;
	@property({ attribute: "value" }) defaultValue = "";
	@property({ reflect: true }) name = "";

	@state() private _current = "";
	/** photos are files, so they're kept apart from the string value */
	@state() private _photos: PhotoSlotValue[] = [];
	@state() private _disabled = false;
	/** like `:user-invalid`, issues show once the user committed an edit or submitted */
	@state() private _committed = false;
	@state() private _descriptionOpen = false;

	private readonly _internals = this.attachInternals();
	private readonly _ids = editFieldIds();
	/** once edited, a new `defaultValue` no longer replaces the current value */
	private _dirty = false;
	private _issues: ValidationIssue[] = [];

	constructor() {
		super();
		this.addEventListener("invalid", () => {
			this._committed = true;
		});
	}

	get value(): string {
		return this._current;
	}
	set value(value: string) {
		this._dirty = true;
		this._current = value;
	}

	get photos(): readonly PhotoSlotValue[] {
		return this._photos;
	}

	// existing photos aren't loaded yet, so any added one is a change
	get changed(): boolean {
		return this.declaration?.type === "photos"
			? this._photos.some((photo) => photo !== null)
			: this._current !== this.defaultValue;
	}

	get form(): HTMLFormElement | null {
		return this._internals.form;
	}
	get validity(): ValidityState {
		return this._internals.validity;
	}
	get validationMessage(): string {
		return this._internals.validationMessage;
	}
	get willValidate(): boolean {
		return this._internals.willValidate;
	}
	checkValidity(): boolean {
		return this._internals.checkValidity();
	}
	reportValidity(): boolean {
		return this._internals.reportValidity();
	}

	formResetCallback(): void {
		this._dirty = false;
		this._committed = false;
		this._current = this.defaultValue;
		releasePhotos(this._photos);
		this._photos =
			this.declaration?.type === "photos" ? emptyPhotos(this.declaration) : [];
	}

	formStateRestoreCallback(state: unknown): void {
		if (typeof state === "string") {
			this.value = state;
		}
	}

	formDisabledCallback(disabled: boolean): void {
		this._disabled = disabled;
	}

	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	protected override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has("defaultValue") && !this._dirty) {
			this._current = this.defaultValue;
		}
		if (this.declaration?.type !== "photos" && this._photos.length > 0) {
			releasePhotos(this._photos);
			this._photos = [];
		}
		if (typeof this.declaration === "undefined") {
			this._issues = [];
			return;
		}
		if (this.name === "") {
			this.name = this.declaration.id;
		}
		if (
			this.declaration.type === "photos" &&
			this._photos.length !== this.declaration.pattern.slots.length
		) {
			const slots = emptyPhotos(this.declaration);
			releasePhotos(this._photos.slice(slots.length));
			this._photos = slots.map((empty, index) => this._photos[index] ?? empty);
		}
		this._issues = validate(
			this.declaration,
			this._current,
			this.defaultValue,
			this._photos,
		);
	}

	protected override updated(): void {
		const internals = this._internals;
		if (this.declaration?.type === "photos") {
			internals.setFormValue(photosFormData(this.name, this._photos));
		} else {
			internals.setFormValue(this._current, this._current);
		}

		const [issue] = this._issues;
		if (typeof issue === "undefined") {
			internals.setValidity({});
		} else {
			// grouped controls (e.g. radios) anchor on their first input
			const control = this.querySelector<HTMLElement>(`#${this._ids.control}`);
			const anchor = control?.matches("input, textarea, select")
				? control
				: (control?.querySelector<HTMLElement>("input, textarea, select") ??
					undefined);
			internals.setValidity({ customError: true }, issueMessage(issue), anchor);
		}

		// styling hooks, `edit-field:state(changed)` / `edit-field:state(user-invalid)`
		this._toggleState("changed", this.changed);
		this._toggleState("user-invalid", this._showIssue);
	}

	private get _showIssue(): boolean {
		return this._committed && this._issues.length > 0;
	}

	private _toggleState(name: string, on: boolean): void {
		if (on) {
			this._internals.states.add(name);
		} else {
			this._internals.states.delete(name);
		}
	}

	private _onInput = (value: string): void => {
		this.value = value;
	};

	private _onPhotos = (photos: PhotoSlotValue[]): void => {
		this._dirty = true;
		this._photos = photos;
	};

	private _onCommit = (): void => {
		this._committed = true;
	};

	private _toggleDescription = (): void => {
		this._descriptionOpen = !this._descriptionOpen;
	};

	private _renderControl(ctx: EditFieldRenderContext<Declaration>) {
		const { declaration } = ctx;
		switch (declaration.type) {
			case "text":
				return renderText({ ...ctx, declaration });
			case "toggle":
				return renderToggle({ ...ctx, declaration });
			case "picker":
				return declaration.resource === "none"
					? renderStaticPicker({ ...ctx, declaration })
					: renderDynamicPicker({ ...ctx, declaration });
			case "photos":
				return renderPhotos(
					{ ...ctx, declaration },
					this._photos,
					this._onPhotos,
				);
		}
	}

	override render() {
		const { declaration } = this;
		if (typeof declaration === "undefined") {
			return nothing;
		}

		const ids = this._ids;
		const label = localized(declaration.label);
		const [issue] = this._issues;
		const showIssue = this._showIssue;
		const describedBy =
			[
				typeof declaration.hint !== "undefined" ? ids.hint : undefined,
				showIssue ? ids.error : undefined,
			]
				.filter((id) => typeof id !== "undefined")
				.join(" ") || undefined;

		return html`
			<div class="edit-field-head">
				<label class="edit-field-label" id=${ids.label} for=${ids.control}>
					${label}
				</label>
				${
					typeof declaration.description !== "undefined"
						? html`<button
								type="button"
								class="edit-field-info"
								aria-expanded=${this._descriptionOpen ? "true" : "false"}
								aria-controls=${ids.description}
								aria-label=${m.edit_field_about({ label })}
								@click=${this._toggleDescription}
							>
								${icon("help")}
							</button>`
						: nothing
				}
			</div>
			${
				typeof declaration.description !== "undefined"
					? html`<p
							class="edit-field-description"
							id=${ids.description}
							?hidden=${!this._descriptionOpen}
						>
							${localized(declaration.description)}
						</p>`
					: nothing
			}
			${
				typeof declaration.hint !== "undefined"
					? html`<p class="edit-field-hint" id=${ids.hint}>
							${localized(declaration.hint)}
						</p>`
					: nothing
			}
			${this._renderControl({
				declaration,
				value: this._current,
				defaultValue: this.defaultValue,
				ids,
				describedBy,
				invalid: showIssue,
				disabled: this._disabled,
				onInput: this._onInput,
				onCommit: this._onCommit,
			})}
			${
				showIssue && typeof issue !== "undefined"
					? html`<p class="edit-field-error" id=${ids.error}>
							${icon("warning")} ${issueMessage(issue)}
						</p>`
					: nothing
			}
		`;
	}
}

defineElementOnce("edit-field", EditField);

declare global {
	interface HTMLElementTagNameMap {
		"edit-field": EditField;
	}
}
