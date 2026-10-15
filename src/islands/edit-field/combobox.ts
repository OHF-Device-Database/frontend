import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { live } from "lit/directives/live.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { PropertyValues } from "lit";

import { m } from "../../paraglide/messages.js";
import { defineElementOnce } from "../../utilities/define-element.js";
import { isAbortError } from "../../utilities/is-abort-error.js";
import { icon } from "../../utilities/presentation/icon.js";
import { highlight } from "../../utilities/search.js";

export type ComboboxOption = {
	value: string;
	label: string;
	detail?: string | undefined;
};
export type ComboboxResult = { options: ComboboxOption[]; total: number };
export type ComboboxSource = {
	search: (term: string, signal: AbortSignal) => Promise<ComboboxResult>;
	/** label of a value that isn't among the loaded options, e.g. the initial one */
	label: (value: string) => Promise<string>;
};

const FETCH_DELAY_MS = 200;

/**
 * editable combobox with a listbox popup, following the WAI-ARIA pattern
 * https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 *
 * only picks existing options: typed text that wasn't picked is reverted
 */
export class EditFieldCombobox extends LitElement {
	@property({ attribute: false }) source: ComboboxSource | undefined;
	@property({ attribute: false }) value = "";
	@property({ attribute: false }) controlId = "";
	@property({ attribute: false }) labelId = "";
	@property({ attribute: false }) describedBy: string | undefined;
	@property({ attribute: false }) invalid = false;
	@property({ attribute: false }) disabled = false;
	/** shows a clear button when set */
	@property({ attribute: false }) clearLabel: string | undefined;

	@state() private _open = false;
	@state() private _term = "";
	/** whether `_term` was typed, otherwise it shows the value's label */
	@state() private _typed = false;
	@state() private _valueLabel = "";
	@state() private _result: ComboboxResult | undefined;
	@state() private _status: "idle" | "loading" | "error" = "idle";
	@state() private _active = -1;

	private _abort: AbortController | undefined;
	private _timer: ReturnType<typeof setTimeout> | undefined;
	private readonly _anchor = createRef<HTMLDivElement>();
	private readonly _popover = createRef<HTMLDivElement>();
	private readonly _input = createRef<HTMLInputElement>();
	private readonly _labels = new Map<string, string>();

	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		clearTimeout(this._timer);
		this._abort?.abort();
	}

	protected override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has("value") || changed.has("source")) {
			this._resolveLabel();
		}
	}

	private _showLabel(label: string): void {
		this._valueLabel = label;
		if (!this._typed) {
			this._term = label;
		}
	}

	private _resolveLabel(): void {
		const { value, source } = this;
		// the value itself until its label is known
		this._showLabel(this._labels.get(value) ?? value);
		if (
			value === "" ||
			this._labels.has(value) ||
			typeof source === "undefined"
		) {
			return;
		}
		source.label(value).then(
			(label) => {
				this._labels.set(value, label);
				if (this.value === value) {
					this._showLabel(label);
				}
			},
			// keeps showing the value
			() => undefined,
		);
	}

	// untyped, the map also holds private state keys
	protected override updated(changed: PropertyValues): void {
		const popover = this._popover.value;
		if (typeof popover !== "undefined" && changed.has("_open")) {
			if (this._open && !popover.matches(":popover-open")) {
				const source = this._anchor.value;
				popover.showPopover(
					typeof source !== "undefined" ? { source } : undefined,
				);
			} else if (!this._open && popover.matches(":popover-open")) {
				popover.hidePopover();
			}
		}
		if (changed.has("_active") && this._active !== -1) {
			this.querySelector(`#${this._optionId(this._active)}`)?.scrollIntoView({
				block: "nearest",
			});
		}
	}

	private get _listboxId(): string {
		return `${this.controlId}-listbox`;
	}

	private _optionId(index: number): string {
		return `${this.controlId}-option-${index}`;
	}

	private get _options(): ComboboxOption[] {
		return this._result?.options ?? [];
	}

	private _openPopup = (): void => {
		if (this._open) {
			return;
		}
		this._open = true;
		this._active = -1;
		void this._fetch();
	};

	private _onInput = (e: Event): void => {
		this._term = (e.currentTarget as HTMLInputElement).value;
		this._typed = true;
		// opens without fetching, the delayed fetch below covers it
		this._open = true;
		this._active = -1;
		clearTimeout(this._timer);
		this._timer = setTimeout(() => void this._fetch(), FETCH_DELAY_MS);
	};

	/** closes without picking, typed text goes back to the value */
	private _dismiss(): void {
		clearTimeout(this._timer);
		this._abort?.abort();
		this._open = false;
		this._typed = false;
		this._term = this._valueLabel;
	}

	/** `undefined` clears */
	private _pick(option: ComboboxOption | undefined): void {
		const value = option?.value ?? "";
		this._labels.set(value, option?.label ?? "");
		this._dismiss();
		this._showLabel(option?.label ?? "");
		this.dispatchEvent(
			new CustomEvent<string>("combobox-pick", { detail: value }),
		);
		// a pick doesn't come from typing, so fire what a native control would
		this.dispatchEvent(new Event("input", { bubbles: true }));
		this.dispatchEvent(new Event("change", { bubbles: true }));
	}

	private async _fetch(): Promise<void> {
		if (typeof this.source === "undefined") {
			return;
		}
		this._abort?.abort();
		const controller = new AbortController();
		this._abort = controller;
		this._status = "loading";

		try {
			// without typing, show the most common options instead of the value alone
			const result = await this.source.search(
				this._typed ? this._term : "",
				controller.signal,
			);
			if (controller.signal.aborted) {
				return;
			}
			for (const option of result.options) {
				this._labels.set(option.value, option.label);
			}
			this._result = result;
			this._status = "idle";
			this._active = -1;
		} catch (error) {
			if (!isAbortError(error)) {
				this._status = "error";
			}
		}
	}

	private _onKeyDown = (e: KeyboardEvent): void => {
		const count = this._options.length;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				if (!this._open) {
					this._openPopup();
				} else if (count > 0) {
					this._active = Math.min(this._active + 1, count - 1);
				}
				break;
			case "ArrowUp":
				e.preventDefault();
				if (this._open && count > 0) {
					this._active = Math.max(this._active - 1, 0);
				}
				break;
			case "Enter": {
				if (!this._open) {
					// lets the form submit
					break;
				}
				e.preventDefault();
				const option = this._options[this._active];
				if (typeof option !== "undefined") {
					this._pick(option);
				} else {
					this._dismiss();
				}
				break;
			}
			case "Escape":
				if (this._open) {
					e.preventDefault();
					this._dismiss();
				}
				break;
			case "Tab":
				this._dismiss();
				break;
		}
	};

	private _onFocusOut = (e: FocusEvent): void => {
		if (!this.contains(e.relatedTarget as Node | null)) {
			this._dismiss();
		}
	};

	private _onClear = (): void => {
		this._pick(undefined);
		this._input.value?.focus();
	};

	private _statusText(): string {
		if (this._status === "loading") {
			return m.edit_field_combobox_loading();
		}
		if (this._status === "error") {
			return m.edit_field_combobox_error();
		}
		const total = this._result?.total ?? 0;
		const shown = this._options.length;
		if (total === 0) {
			return m.edit_field_combobox_empty();
		}
		if (total > shown) {
			return m.edit_field_combobox_more({ shown, total });
		}

		return m.edit_field_combobox_count({ count: total });
	}

	override render() {
		const active = this._open && this._active !== -1;

		return html`
			<div
				class="edit-field-control"
				${ref(this._anchor)}
				@focusout=${this._onFocusOut}
			>
				<span class="edit-field-prefix">${icon("search")}</span>
				<input
					type="text"
					id=${this.controlId}
					role="combobox"
					aria-autocomplete="list"
					aria-expanded=${this._open ? "true" : "false"}
					aria-controls=${this._listboxId}
					aria-activedescendant=${active ? this._optionId(this._active) : nothing}
					aria-describedby=${ifDefined(this.describedBy)}
					aria-invalid=${this.invalid ? "true" : nothing}
					autocomplete="off"
					spellcheck="false"
					.value=${live(this._term)}
					?disabled=${this.disabled}
					${ref(this._input)}
					@input=${this._onInput}
					@keydown=${this._onKeyDown}
					@click=${this._openPopup}
				/>
				${
					typeof this.clearLabel !== "undefined" && this.value !== ""
						? html`<button
								type="button"
								class="edit-field-clear"
								aria-label=${this.clearLabel}
								?disabled=${this.disabled}
								@click=${this._onClear}
							>
								${icon("x")}
							</button>`
						: nothing
				}
			</div>
			<div
				class="edit-field-popover"
				popover="manual"
				${ref(this._popover)}
				@mousedown=${(e: MouseEvent) => e.preventDefault()}
			>
				<ul
					role="listbox"
					id=${this._listboxId}
					aria-labelledby=${this.labelId}
				>
					${this._options.map(
						(option, index) => html`
							<li
								role="option"
								id=${this._optionId(index)}
								aria-selected=${index === this._active ? "true" : "false"}
								class=${option.value === this.value ? "is-current" : ""}
								@click=${() => this._pick(option)}
							>
								<span>
									${this._typed ? highlight(option.label, this._term) : option.label}
								</span>
								${
									typeof option.detail !== "undefined"
										? html`<span class="edit-field-option-detail">
												${option.detail}
											</span>`
										: nothing
								}
							</li>
						`,
					)}
				</ul>
				<p class="edit-field-popover-status" role="status">
					${this._open ? this._statusText() : nothing}
				</p>
			</div>
		`;
	}
}

defineElementOnce("edit-field-combobox", EditFieldCombobox);

declare global {
	interface HTMLElementTagNameMap {
		"edit-field-combobox": EditFieldCombobox;
	}
}
