import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { PropertyValues } from "lit";

import { m } from "../paraglide/messages.js";
import { defineElementOnce } from "../utilities/define-element.js";
import { localized } from "../utilities/localized.js";
import { icon } from "../utilities/presentation/icon.js";
import { notifyChange } from "./edit-field/events";
import type { Declaration } from "../types/declaration";
import type { EditField } from "./edit-field.js";

import "./edit-field.js";

/**
 * form of edit fields, submitting only the changed ones
 *
 * reverting lives here rather than in each field, so every field type
 * offers it the same way regardless of its own design
 */
export class EditForm extends LitElement {
	@property({ attribute: false }) declarations: Declaration[] = [];
	/** values from the server by declaration id, missing or empty means not set */
	@property({ attribute: false }) values: Readonly<Record<string, string>> = {};

	/** ids of the changed fields */
	@state() private _changed: ReadonlySet<string> = new Set();

	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	protected override updated(changed: PropertyValues<this>): void {
		// fields pick up new values in their own update
		if (changed.has("declarations") || changed.has("values")) {
			void Promise.all(this._fields.map((field) => field.updateComplete)).then(
				this._sync,
			);
		}
	}

	private get _fields(): EditField[] {
		return [...this.querySelectorAll("edit-field")];
	}

	private _sync = (): void => {
		this._changed = new Set(
			this._fields.flatMap((field) =>
				field.changed && typeof field.declaration !== "undefined"
					? [field.declaration.id]
					: [],
			),
		);
	};

	private async _revert(id: string): Promise<void> {
		const field = this._fields.find(
			(candidate) => candidate.declaration?.id === id,
		);
		if (typeof field === "undefined") {
			return;
		}
		field.revert();
		// the revert button disappears, so focus moves to the field
		await field.updateComplete;
		field.focus();
		notifyChange(field);
	}

	// `novalidate` skips the native bubbles, fields show their own errors
	private _onSubmit = (e: SubmitEvent): void => {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		if (!form.checkValidity()) {
			form.querySelector<HTMLElement>(":invalid")?.focus();
			return;
		}
		this.dispatchEvent(
			new CustomEvent<FormData>("edit-form-submit", {
				detail: new FormData(form),
				bubbles: true,
			}),
		);
	};

	private _onReset = (): void => {
		// after a real click a microtask still runs before the fields reset
		setTimeout(this._sync);
	};

	override render() {
		const nothingChanged = this._changed.size === 0;

		return html`
			<form
				class="edit-form"
				novalidate
				@input=${this._sync}
				@change=${this._sync}
				@submit=${this._onSubmit}
				@reset=${this._onReset}
			>
				${repeat(
					this.declarations,
					(declaration) => declaration.id,
					(declaration) => html`
						<div class="edit-form-row">
							<edit-field
								.declaration=${declaration}
								value=${this.values[declaration.id] ?? ""}
							></edit-field>
							${
								this._changed.has(declaration.id)
									? html`<button
											type="button"
											class="edit-form-revert"
											aria-label=${m.edit_form_revert_field({
												label: localized(declaration.label),
											})}
											@click=${() => void this._revert(declaration.id)}
										>
											${icon("undo")} ${m.edit_form_revert()}
										</button>`
									: nothing
							}
						</div>
					`,
				)}
				<div class="edit-form-actions">
					<button
						type="submit"
						class="btn btn-primary"
						?disabled=${nothingChanged}
					>
						${m.edit_form_submit()}
					</button>
					<button
						type="reset"
						class="btn btn-secondary"
						?disabled=${nothingChanged}
					>
						${m.edit_form_reset()}
					</button>
				</div>
			</form>
		`;
	}
}

defineElementOnce("edit-form", EditForm);

declare global {
	interface HTMLElementTagNameMap {
		"edit-form": EditForm;
	}
	interface HTMLElementEventMap {
		"edit-form-submit": CustomEvent<FormData>;
	}
}
