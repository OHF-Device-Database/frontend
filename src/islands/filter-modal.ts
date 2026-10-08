import { navigate } from "astro:transitions/client";
import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { defineElementOnce } from "../utilities/define-element.js";
import * as presentation from "../utilities/presentation";
import { PresentationRenderPresetRoleIcon } from "../utilities/presentation/preset.js";
import { highlight, rank } from "../utilities/search.js";

export type FilterModalMode = "include" | "exclude";

export interface FilterModalOption {
	id: string;
	label: string;
	count?: number | undefined;
}

export type GroupingConfig = "alphabet" | "none";

export const groupOptions = (
	options: FilterModalOption[],
	query: string,
	groupBy: GroupingConfig,
): (readonly [string, FilterModalOption[]])[] => {
	const matched = rank(options, query, ({ label }) => label);
	if (groupBy === "none") {
		return [["", matched] as const];
	}

	const groups = new Map<string, FilterModalOption[]>();
	const ungrouped: FilterModalOption[] = [];
	for (const option of matched) {
		const letter = option.label.at(0)?.normalize().trim().toUpperCase();
		if (typeof letter === "undefined" || !/[A-Z]/.test(letter)) {
			ungrouped.push(option);
			continue;
		}
		const list = groups.get(letter) ?? [];
		list.push(option);
		groups.set(letter, list);
	}

	return [
		...[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)),
		...(ungrouped.length > 0 ? [["#", ungrouped] as const] : []),
	];
};

export class FilterModal extends LitElement {
	@property() dim = "";
	@property() label = "";
	@property() searchplaceholder = "";
	@property() emptylabel = "";
	@property({ type: Array }) options: FilterModalOption[] = [];
	@property({ type: Array }) selected: string[] = [];
	@property() mode: FilterModalMode = "include";
	@property({ type: Boolean }) lettergroups = false;

	@state() private _open = false;
	@state() private _query = "";
	@state() private _draftSelected = new Set<string>();
	@state() private _draftMode: FilterModalMode = "include";
	@state() private _groupBy: GroupingConfig = "none";

	private _onOpenFilter = (e: Event): void => {
		if ((e as CustomEvent<{ dim: string }>).detail.dim === this.dim) {
			this._openModal();
		}
	};

	private _onKey = (e: KeyboardEvent): void => {
		if (e.key === "Escape") {
			this._close();
		}
	};

	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener("browse:open-filter", this._onOpenFilter);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener("browse:open-filter", this._onOpenFilter);
		this._release();
	}

	private _openModal(): void {
		this._open = true;
		this._query = "";
		this._draftSelected = new Set(this.selected);
		this._draftMode = this.mode;
		this._groupBy = "none";
		document.body.classList.add("modal-open");
		document.addEventListener("keydown", this._onKey);
	}

	private _release(): void {
		document.body.classList.remove("modal-open");
		document.removeEventListener("keydown", this._onKey);
	}

	private _close = (): void => {
		if (!this._open) {
			return;
		}
		this._open = false;
		this._release();

		const before = new Set(this.selected);
		const unchanged =
			this._draftMode === this.mode &&
			this._draftSelected.size === before.size &&
			[...this._draftSelected].every((id) => before.has(id));
		if (unchanged) {
			return;
		}

		// Rewrite only this dimension's parameters so the term, the other
		// dimension, and the locale prefix (part of the pathname) all survive.
		const params = new URLSearchParams(window.location.search);
		params.delete(this.dim);
		params.delete(`${this.dim}Mode`);
		params.delete("page");
		for (const id of [...this._draftSelected].toSorted()) {
			params.append(this.dim, id);
		}
		if (this._draftSelected.size > 0 && this._draftMode === "exclude") {
			params.set(`${this.dim}Mode`, "exclude");
		}
		const qs = params.toString();
		void navigate(
			`${window.location.pathname}${qs.length > 0 ? `?${qs}` : ""}`,
		);
	};

	private _draftToggle(id: string): void {
		const next = new Set(this._draftSelected);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		this._draftSelected = next;
	}

	private _renderModeButton(mode: FilterModalMode, text: string) {
		return html`
			<button
				type="button"
				class=${"filter-mode-btn" + (this._draftMode === mode ? " is-active" : "")}
				aria-pressed=${this._draftMode === mode}
				@click=${() => (this._draftMode = mode)}
			>
				<span>${text}</span>
			</button>
		`;
	}

	override render() {
		if (!this._open) {
			return nothing;
		}
		const matchedGroups = groupOptions(
			this.options,
			this._query,
			this.lettergroups ? this._groupBy : "none",
		);
		const matchedCount = matchedGroups.reduce(
			(sum, [, options]) => sum + options.length,
			0,
		);

		return html`
			<div class="modal-backdrop" role="presentation" @click=${this._close}>
				<div
					class="modal-dialog modal-tall"
					role="dialog"
					aria-modal="true"
					aria-label=${this.label}
					@click=${(e: Event) => e.stopPropagation()}
				>
					<header class="modal-head">
						<div class="modal-head-row">
							<button
								class="modal-close"
								aria-label=${m.browse_modal_close()}
								@click=${this._close}
							>
								${unsafeHTML(presentation.render(presentation.generic("x"), PresentationRenderPresetRoleIcon.withSize(18)))}
							</button>
							<h2>${this.label}</h2>
							<div
								class="filter-mode"
								role="group"
								aria-label=${m.browse_mode_label()}
							>
								${this._renderModeButton("include", m.browse_mode_is())}
								${this._renderModeButton("exclude", m.browse_mode_is_not())}
							</div>
						</div>
						<div class="modal-head-search">
							<div class="modal-search-input">
								${unsafeHTML(presentation.render(presentation.generic("search"), PresentationRenderPresetRoleIcon.withSize(18)))}
								<input
									type="search"
									.value=${this._query}
									placeholder=${this.searchplaceholder}
									aria-label=${this.searchplaceholder}
									@input=${(e: Event) => (this._query = (e.target as HTMLInputElement).value)}
								/>
							</div>
							${
								this.lettergroups
									? html`<div
											class="filter-mode"
											role="group"
											aria-label=${m.browse_sheet_grouping_label()}
										>
											<button
												type="button"
												class=${"filter-mode-btn" + (this._groupBy === "none" ? " is-active" : "")}
												aria-pressed=${this._groupBy === "none"}
												@click=${() => (this._groupBy = "none")}
											>
												<span>${m.browse_sheet_grouping_none()}</span>
											</button>
											<button
												type="button"
												class=${"filter-mode-btn" + (this._groupBy === "alphabet" ? " is-active" : "")}
												aria-pressed=${this._groupBy === "alphabet"}
												@click=${() => (this._groupBy = "alphabet")}
											>
												<span>${m.browse_sheet_grouping_alpha()}</span>
											</button>
										</div>`
									: nothing
							}
						</div>
					</header>
					<div class="modal-body">
						${
							matchedCount === 0
								? html`<div class="modal-empty">
										${m.browse_modal_no_matches({ term: this._query.trim() })}
									</div>`
								: matchedGroups.map(
										([letter, options]) => html`
											<section class="modal-group">
												${letter.length > 0 ? html`<div class="modal-group-head">${letter}</div>` : nothing}
												<div class="modal-group-rows">
													${options.map(
														(option) => html`
															<label class="filter-row">
																<input
																	type="checkbox"
																	.checked=${this._draftSelected.has(option.id)}
																	@change=${() => this._draftToggle(option.id)}
																/>
																<span class="filter-row-text"
																	>${highlight(option.label, this._query)}</span
																>
																${
																	typeof option.count !== "undefined"
																		? html`<span class="count"
																				>${option.count.toLocaleString(getLocale())}</span
																			>`
																		: nothing
																}
															</label>
														`,
													)}
												</div>
											</section>
										`,
									)
						}
					</div>
					<footer class="modal-foot">
						${
							this._draftSelected.size === 0
								? html`<span class="modal-foot-meta">${this.emptylabel}</span>`
								: html`<button
										type="button"
										class="modal-foot-clear"
										@click=${() => (this._draftSelected = new Set())}
									>
										${m.browse_modal_clear_selected({
											count: this._draftSelected.size,
										})}
									</button>`
						}
						<button class="btn btn-primary" @click=${this._close}>
							${m.browse_modal_view_results()}
						</button>
					</footer>
				</div>
			</div>
		`;
	}
}

defineElementOnce("filter-modal", FilterModal);

declare global {
	interface HTMLElementTagNameMap {
		"filter-modal": FilterModal;
	}
	interface WindowEventMap {
		"browse:open-filter": CustomEvent<{ dim: string }>;
	}
}
