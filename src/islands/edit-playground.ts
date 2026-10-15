import { z } from "astro/zod";
import { html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { getDeclarations } from "../io/declaration";
import { Declaration } from "../types/declaration";
import { defineElementOnce } from "../utilities/define-element.js";
import * as presentation from "../utilities/presentation";
import { PresentationRenderPresetRoleIcon } from "../utilities/presentation/preset.js";
import type { EditField } from "./edit-field.js";

import "./edit-field.js";

// temporary page to debug one declaration at a time, intentionally english only

const PRESET_VALUES: Record<string, string> = {
	name: "Hue White A19",
	ean: "4006381333931",
	"light.dimming": "true",
	"local-operation": "cloud-ish",
};

type FieldSnapshot = {
	value: string;
	defaultValue: string;
	changed: boolean;
	valid: boolean;
	validationMessage: string;
	userInvalid: boolean;
};

const snapshot = (field: EditField): FieldSnapshot => ({
	value: field.value,
	defaultValue: field.defaultValue,
	changed: field.changed,
	valid: field.validity.valid,
	validationMessage: field.validationMessage,
	userInvalid: field.matches(":state(user-invalid)"),
});

const parseDeclaration = (
	source: string,
): { declaration: Declaration } | { error: string } => {
	let json: unknown;
	try {
		json = JSON.parse(source);
	} catch (e) {
		return { error: e instanceof Error ? e.message : String(e) };
	}
	const result = Declaration.safeParse(json);

	return result.success
		? { declaration: result.data }
		: { error: z.prettifyError(result.error) };
};

export class EditPlayground extends LitElement {
	@state() private _presets: Declaration[] = [];
	@state() private _presetId = "";
	@state() private _source = "";
	@state() private _declaration: Declaration | undefined;
	@state() private _error: string | undefined;
	@state() private _initialValue = "";
	@state() private _snapshot: FieldSnapshot | undefined;
	@state() private _submitted: [string, string][] | undefined;

	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		// `invalid` doesn't bubble, capture it to reflect submit attempts
		this.addEventListener("invalid", this._refresh, true);
		void getDeclarations().then(({ declarations }) => {
			this._presets = declarations;
			const [first] = declarations;
			if (typeof first !== "undefined") {
				this._loadPreset(first);
			}
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.removeEventListener("invalid", this._refresh, true);
	}

	private _loadPreset(declaration: Declaration): void {
		this._presetId = declaration.id;
		this._source = JSON.stringify(declaration, null, 2);
		this._declaration = declaration;
		this._error = undefined;
		this._initialValue = PRESET_VALUES[declaration.id] ?? "";
		this._submitted = undefined;
		this._refresh();
	}

	// reads the field once it rendered the latest change
	private _refresh = (): void => {
		void this._readField();
	};

	private async _readField(): Promise<void> {
		await this.updateComplete;
		const field = this.querySelector("edit-field");
		if (field === null) {
			this._snapshot = undefined;
			return;
		}
		await field.updateComplete;
		this._snapshot = snapshot(field);
	}

	private _onPreset = (e: Event): void => {
		const id = (e.currentTarget as HTMLSelectElement).value;
		const declaration = this._presets.find((preset) => preset.id === id);
		if (typeof declaration !== "undefined") {
			this._loadPreset(declaration);
		}
	};

	private _onSource = (e: Event): void => {
		this._source = (e.currentTarget as HTMLTextAreaElement).value;
		const parsed = parseDeclaration(this._source);
		if ("error" in parsed) {
			// keep rendering the last valid declaration
			this._error = parsed.error;
			return;
		}
		this._error = undefined;
		this._declaration = parsed.declaration;
		this._refresh();
	};

	private _onInitialValue = (e: Event): void => {
		this._initialValue = (e.currentTarget as HTMLInputElement).value;
		this._refresh();
	};

	private _onSubmit = (e: SubmitEvent): void => {
		e.preventDefault();
		this._submitted = [
			...new FormData(e.currentTarget as HTMLFormElement).entries(),
		].map(([key, value]) => [
			key,
			typeof value === "string" ? value : value.name,
		]);
		this._refresh();
	};

	private _onReset = (): void => {
		this._submitted = undefined;
		// `reset` fires before the controls reset
		void Promise.resolve().then(this._refresh);
	};

	private _renderPresets() {
		return html`
			<label class="edit-playground-source">
				<span>Preset</span>
				<div class="select">
					<select .value=${this._presetId} @change=${this._onPreset}>
						${this._presets.map(
							(preset) =>
								html`<option value=${preset.id}>
									${preset.id} (${preset.type})
								</option>`,
						)}
					</select>
					<span class="select-chevron" aria-hidden="true">
						${unsafeHTML(
							presentation.render(
								presentation.generic("chevronDown"),
								PresentationRenderPresetRoleIcon,
							),
						)}
					</span>
				</div>
			</label>
		`;
	}

	override render() {
		return html`
			<div class="edit-playground-sources">
				${this._renderPresets()}
				<label class="edit-playground-source">
					<span>Declaration</span>
					<textarea
						spellcheck="false"
						.value=${this._source}
						aria-invalid=${typeof this._error !== "undefined" ? "true" : nothing}
						@input=${this._onSource}
					></textarea>
				</label>
				${
					typeof this._error !== "undefined"
						? html`<pre class="edit-playground-error">${this._error}</pre>`
						: nothing
				}
				<label class="edit-playground-source">
					<span>Initial value</span>
					<input
						type="text"
						spellcheck="false"
						.value=${this._initialValue}
						@input=${this._onInitialValue}
					/>
				</label>
			</div>

			<div class="edit-playground-preview">
				<form
					class="edit-playground-form"
					@input=${this._refresh}
					@change=${this._refresh}
					@submit=${this._onSubmit}
					@reset=${this._onReset}
				>
					${
						typeof this._declaration !== "undefined"
							? keyed(
									this._presetId,
									html`<edit-field
										.declaration=${this._declaration}
										value=${this._initialValue}
									></edit-field>`,
								)
							: nothing
					}
					<div class="edit-playground-actions">
						<button type="submit" class="btn btn-primary">Submit</button>
						<button type="reset" class="btn btn-secondary">Reset</button>
					</div>
				</form>

				<section class="edit-playground-output">
					<h2>State</h2>
					<pre>${JSON.stringify(this._snapshot ?? null, null, 2)}</pre>
				</section>

				${
					typeof this._submitted !== "undefined"
						? html`<section class="edit-playground-output">
								<h2>Submitted form data</h2>
								<pre>${JSON.stringify(this._submitted, null, 2)}</pre>
							</section>`
						: nothing
				}
			</div>
		`;
	}
}

defineElementOnce("edit-playground", EditPlayground);

declare global {
	interface HTMLElementTagNameMap {
		"edit-playground": EditPlayground;
	}
}
