import { z } from "astro/zod";
import { html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { live } from "lit/directives/live.js";

import { getDeclarations } from "../io/declaration";
import { Declaration } from "../types/declaration";
import { defineElementOnce } from "../utilities/define-element.js";
import { icon } from "../utilities/presentation/icon.js";
import type { EditField } from "./edit-field.js";

import "./edit-field.js";

// temporary page to debug one declaration at a time, intentionally english only

type Editor = "text" | "toggle" | "options" | "resource" | "photos";

const EDITORS: Record<Editor, string> = {
	text: "Text",
	toggle: "Toggle",
	options: "Picker with fixed options",
	resource: "Picker with server data",
	photos: "Photos",
};

const editorOf = (declaration: Declaration): Editor => {
	if (declaration.type !== "picker") {
		return declaration.type;
	}

	return declaration.resource === "none" ? "options" : "resource";
};

// variants the mocked declarations don't cover
const EXTRA_EXAMPLES: Declaration[] = [
	{
		id: "notes",
		type: "text",
		label: { en: "Notes" },
		hint: { en: "Anything else worth knowing about the device" },
		pattern: {
			multiline: true,
			length: { max: 500 },
			kind: "letter",
			regex: "[\\p{L}\\p{M}\\p{N}\\p{P}\\p{Zs}\\p{Sc}\\p{Sm}]",
		},
	},
	{
		id: "battery-powered",
		type: "toggle",
		label: { en: "Battery powered" },
		hint: { en: "Runs on batteries" },
	},
];

const EXAMPLE_VALUES: Record<string, string> = {
	name: "Hue White A19",
	ean: "4006381333931",
	"light.dimming": "true",
	"local-operation": "cloud-ish",
	brand: "Philips",
	category: "lighting",
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
	@state() private _examples: Declaration[] = [];
	@state() private _editor: Editor = "text";
	@state() private _exampleId = "";
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
			this._examples = [...declarations, ...EXTRA_EXAMPLES];
			this._loadEditor(this._editor);
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.removeEventListener("invalid", this._refresh, true);
	}

	private _examplesOf(editor: Editor): Declaration[] {
		return this._examples.filter(
			(declaration) => editorOf(declaration) === editor,
		);
	}

	private _loadEditor(editor: Editor): void {
		this._editor = editor;
		const [first] = this._examplesOf(editor);
		if (typeof first !== "undefined") {
			this._loadExample(first);
		}
	}

	private _loadExample(declaration: Declaration): void {
		this._exampleId = declaration.id;
		this._source = JSON.stringify(declaration, null, 2);
		this._declaration = declaration;
		this._error = undefined;
		this._initialValue = EXAMPLE_VALUES[declaration.id] ?? "";
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

	private _onEditor = (e: Event): void => {
		this._loadEditor((e.currentTarget as HTMLSelectElement).value as Editor);
	};

	private _onExample = (e: Event): void => {
		const id = (e.currentTarget as HTMLSelectElement).value;
		const declaration = this._examples.find((example) => example.id === id);
		if (typeof declaration !== "undefined") {
			this._loadExample(declaration);
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

	// `novalidate` skips the native bubbles, fields show their own errors
	private _onSubmit = (e: SubmitEvent): void => {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		if (!form.checkValidity()) {
			form.querySelector<HTMLElement>(":invalid")?.focus();
			this._submitted = undefined;
			this._refresh();
			return;
		}
		this._submitted = [...new FormData(form).entries()].map(([key, value]) => [
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

	private _renderSelect(
		label: string,
		value: string,
		options: { value: string; label: string }[],
		onChange: (e: Event) => void,
	) {
		return html`
			<label class="edit-playground-source">
				<span>${label}</span>
				<div class="select">
					<select @change=${onChange}>
						${options.map(
							// on the options, `.value` on the select would apply before they're replaced
							(option) =>
								html`<option
									value=${option.value}
									.selected=${live(option.value === value)}
								>
									${option.label}
								</option>`,
						)}
					</select>
					<span class="select-chevron" aria-hidden="true">
						${icon("chevronDown", 20)}
					</span>
				</div>
			</label>
		`;
	}

	private _renderPickers() {
		const editors = (Object.keys(EDITORS) as Editor[]).filter(
			(editor) => this._examplesOf(editor).length > 0,
		);

		return html`
			<div class="edit-playground-pickers">
				${this._renderSelect(
					"Editor",
					this._editor,
					editors.map((editor) => ({ value: editor, label: EDITORS[editor] })),
					this._onEditor,
				)}
				${this._renderSelect(
					"Example",
					this._exampleId,
					this._examplesOf(this._editor).map((example) => ({
						value: example.id,
						label: example.label.en,
					})),
					this._onExample,
				)}
			</div>
		`;
	}

	override render() {
		return html`
			<div class="edit-playground-sources">
				${this._renderPickers()}
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
					novalidate
					@input=${this._refresh}
					@change=${this._refresh}
					@submit=${this._onSubmit}
					@reset=${this._onReset}
				>
					${
						typeof this._declaration !== "undefined"
							? keyed(
									this._exampleId,
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
