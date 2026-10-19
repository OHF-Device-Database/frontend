import { z } from "astro/zod";
import { html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { live } from "lit/directives/live.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { PropertyValues } from "lit";

import "../styles/edit-field-view.css";

import { getDeclarations, getResourceOptions } from "../io/declaration";
import { Declaration } from "../types/declaration";
import { defineElementOnce } from "../utilities/define-element.js";
import { renderEditFieldView } from "../utilities/edit-field-view.js";
import { toHtml } from "../utilities/markup.js";
import { icon } from "../utilities/presentation/icon.js";
import { notifyChange } from "./edit-field/events.js";
import type { EditFieldViewPhoto } from "../utilities/edit-field-view.js";
import type { EditField } from "./edit-field.js";

import "./edit-form.js";

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
	@state() private _mode: "view" | "edit" = "edit";
	/** submitted photos, kept as if the device had them */
	@state() private _savedPhotos: EditFieldViewPhoto[] = [];
	/** name of a brand or category value, for the view */
	@state() private _resourceLabel: string | undefined;
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

	// untyped, the map holds private state keys
	protected override willUpdate(changed: PropertyValues): void {
		if (changed.has("_declaration") || changed.has("_initialValue")) {
			void this._resolveResourceLabel();
		}
	}

	private async _resolveResourceLabel(): Promise<void> {
		const declaration = this._declaration;
		const value = this._initialValue;
		this._resourceLabel = undefined;
		if (
			declaration?.type !== "picker" ||
			declaration.resource === "none" ||
			value === ""
		) {
			return;
		}
		const options = await getResourceOptions(declaration.resource);
		// skip if another declaration or value came in meanwhile
		if (this._declaration === declaration && this._initialValue === value) {
			this._resourceLabel = options.find(({ id }) => id === value)?.name;
		}
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
		this._setSavedPhotos([]);
		this._refresh();
	}

	private _setSavedPhotos(photos: EditFieldViewPhoto[]): void {
		for (const photo of this._savedPhotos) {
			if (!photos.includes(photo)) {
				URL.revokeObjectURL(photo.src);
			}
		}
		this._savedPhotos = photos;
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

	private _onMode = (e: Event): void => {
		this._mode = (e.currentTarget as HTMLInputElement).value as "view" | "edit";
		this._refresh();
	};

	// stands in for the server accepting the proposal: what was submitted
	// becomes the device data, so the view shows it and edits start from it
	private _onSubmit = (e: CustomEvent<FormData>): void => {
		const data = e.detail;
		this._submitted = [...data.entries()].map(([key, value]) => [
			key,
			typeof value === "string" ? value : value.name,
		]);

		const declaration = this._declaration;
		if (declaration?.type === "photos") {
			const added = [...data.entries()].flatMap(([key, file]) => {
				if (!(file instanceof File)) {
					return [];
				}
				const category = data.get(`${key}.category`);
				return [
					{
						src: URL.createObjectURL(file),
						alt: file.name,
						category: typeof category === "string" ? category : "",
					},
				];
			});
			this._setSavedPhotos([...this._savedPhotos, ...added]);
			// saved, so they're no longer pending in the form
			const field = this.querySelector("edit-field");
			if (field !== null) {
				field.revert();
				notifyChange(field);
			}
		} else if (typeof declaration !== "undefined") {
			const value = data.get(declaration.id);
			if (typeof value === "string") {
				this._initialValue = value;
			}
		}
		this._refresh();
	};

	private _onReset = (): void => {
		this._submitted = undefined;
		// after a real click a microtask still runs before the fields reset
		setTimeout(this._refresh);
	};

	private _renderMode() {
		// same look as the toggle field
		return html`
			<div class="edit-playground-source">
				<span id="edit-playground-mode">Mode</span>
				<div
					class="edit-field-toggle"
					role="radiogroup"
					aria-labelledby="edit-playground-mode"
				>
					${(["view", "edit"] as const).map(
						(mode) => html`
							<label>
								<input
									type="radio"
									name="edit-playground-mode"
									value=${mode}
									.checked=${live(this._mode === mode)}
									@change=${this._onMode}
								/>
								${mode === "view" ? "View" : "Edit"}
							</label>
						`,
					)}
				</div>
			</div>
		`;
	}

	private _renderView(declaration: Declaration) {
		return html`<dl class="edit-field-views">
			${unsafeHTML(
				toHtml(
					renderEditFieldView({
						declaration,
						value: this._initialValue,
						resourceLabel: this._resourceLabel,
						photos: this._savedPhotos,
					}),
				),
			)}
		</dl>`;
	}

	// hidden instead of removed in view mode, so edits survive switching
	private _renderEdit(declaration: Declaration) {
		return html`<div
			class="edit-playground-edit"
			?hidden=${this._mode !== "edit"}
		>
			${keyed(
				this._exampleId,
				html`<edit-form
					.declarations=${[declaration]}
					.values=${{ [declaration.id]: this._initialValue }}
					@input=${this._refresh}
					@change=${this._refresh}
					@reset=${this._onReset}
					@edit-form-submit=${this._onSubmit}
				></edit-form>`,
			)}

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
		</div>`;
	}

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
				${this._renderMode()}
				${
					typeof this._declaration === "undefined"
						? nothing
						: html`
								${this._mode === "view" ? this._renderView(this._declaration) : nothing}
								${this._renderEdit(this._declaration)}
							`
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
