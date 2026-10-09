import { navigate } from "astro:transitions/client";
import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { defineElementOnce } from "../utilities/define-element.js";
import * as presentation from "../utilities/presentation";
import { PresentationRenderPresetRoleIcon } from "../utilities/presentation/preset.js";
import { highlight } from "../utilities/search.js";
import { groupOptions } from "./filter-modal.js";
import type {
	FilterModalMode,
	FilterModalOption,
	GroupingConfig,
} from "./filter-modal.js";

type SheetDimension = "category" | "manufacturer";

type SheetFilters = {
	category: Set<string>;
	categoryMode: FilterModalMode;
	manufacturer: Set<string>;
	manufacturerMode: FilterModalMode;
	localOnly: boolean;
};

interface DimensionConfig {
	dim: SheetDimension;
	label: string;
	searchPlaceholder: string;
	emptyLabel: string;
	options: FilterModalOption[];
	letterGroups: boolean;
}

const icon = (name: Parameters<typeof presentation.generic>[0], size: number) =>
	unsafeHTML(
		presentation.render(
			presentation.generic(name),
			PresentationRenderPresetRoleIcon.withSize(size),
		),
	);

export class FilterSheet extends LitElement {
	@property({ type: Array }) categoryoptions: FilterModalOption[] = [];
	@property({ type: Array }) manufactureroptions: FilterModalOption[] = [];

	@state() private _open = false;
	@state() private _subView: SheetDimension | null = null;
	@state() private _query = "";
	@state() private _draft: SheetFilters | null = null;
	@state() private _groupBy: GroupingConfig = "none";

	private _onOpenSheet = (): void => {
		this._openSheet();
	};

	private _onKey = (e: KeyboardEvent): void => {
		if (e.key !== "Escape") {
			return;
		}
		if (this._subView !== null) {
			this._subView = null;
		} else {
			this._close();
		}
	};

	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener("browse:open-sheet", this._onOpenSheet);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener("browse:open-sheet", this._onOpenSheet);
		this._release();
	}

	private _fromLocation(): SheetFilters {
		const params = new URLSearchParams(window.location.search);

		return {
			category: new Set(params.getAll("category")),
			categoryMode:
				params.get("categoryMode") === "exclude" ? "exclude" : "include",
			manufacturer: new Set(params.getAll("manufacturer")),
			manufacturerMode:
				params.get("manufacturerMode") === "exclude" ? "exclude" : "include",
			localOnly: params.get("local") === "1",
		};
	}

	private _toSearch(filters: SheetFilters): string {
		const params = new URLSearchParams(window.location.search);
		for (const key of [
			"category",
			"categoryMode",
			"manufacturer",
			"manufacturerMode",
			"local",
			"page",
		]) {
			params.delete(key);
		}
		for (const id of [...filters.category].toSorted()) {
			params.append("category", id);
		}
		if (filters.category.size > 0 && filters.categoryMode === "exclude") {
			params.set("categoryMode", "exclude");
		}
		for (const name of [...filters.manufacturer].toSorted()) {
			params.append("manufacturer", name);
		}
		if (
			filters.manufacturer.size > 0 &&
			filters.manufacturerMode === "exclude"
		) {
			params.set("manufacturerMode", "exclude");
		}
		if (filters.localOnly) {
			params.set("local", "1");
		}

		return params.toString();
	}

	private get _active(): SheetFilters {
		return this._draft ?? this._fromLocation();
	}

	private get _dimensions(): DimensionConfig[] {
		return [
			{
				dim: "category",
				label: m.browse_category_label(),
				searchPlaceholder: m.browse_modal_search_categories(),
				emptyLabel: m.browse_modal_empty_categories(),
				options: this.categoryoptions,
				letterGroups: false,
			},
			{
				dim: "manufacturer",
				label: m.browse_manufacturer_label(),
				searchPlaceholder: m.browse_modal_search_manufacturers(),
				emptyLabel: m.browse_modal_empty_manufacturers(),
				options: this.manufactureroptions,
				letterGroups: true,
			},
		];
	}

	private _openSheet(): void {
		this._draft = this._fromLocation();
		this._open = true;
		this._subView = null;
		this._query = "";
		this._groupBy = "none";
		document.body.classList.add("modal-open");
		document.addEventListener("keydown", this._onKey);
	}

	private _close = (): void => {
		const draft = this._draft;
		this._open = false;
		this._subView = null;
		this._draft = null;
		this._release();

		if (draft === null) {
			return;
		}
		const next = this._toSearch(draft);
		if (next === this._toSearch(this._fromLocation())) {
			return;
		}
		void navigate(
			`${window.location.pathname}${next.length > 0 ? `?${next}` : ""}`,
		);
	};

	private _release(): void {
		document.body.classList.remove("modal-open");
		document.removeEventListener("keydown", this._onKey);
	}

	private _dragStartY: number | null = null;
	private _dragDy = 0;
	private _dragStartT = 0;

	private get _panel(): HTMLElement | null {
		return this.querySelector<HTMLElement>(".sheet-panel");
	}

	private _onGrabStart = (e: PointerEvent): void => {
		this._dragStartY = e.clientY;
		this._dragDy = 0;
		this._dragStartT = performance.now();
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			// pointer capture is best-effort
		}
		if (this._panel !== null) {
			this._panel.style.transition = "none";
		}
	};

	private _onGrabMove = (e: PointerEvent): void => {
		if (this._dragStartY === null) {
			return;
		}
		this._dragDy = Math.max(0, e.clientY - this._dragStartY);
		if (this._panel !== null) {
			this._panel.style.transform = `translateY(${this._dragDy}px)`;
		}
	};

	private _onGrabEnd = (): void => {
		if (this._dragStartY === null) {
			return;
		}
		this._dragStartY = null;
		const panel = this._panel;
		if (panel === null) {
			return;
		}
		const dy = this._dragDy;
		const velocity = dy / Math.max(1, performance.now() - this._dragStartT);
		if (dy > panel.clientHeight * 0.25 || (dy > 24 && velocity > 0.5)) {
			panel.style.transition = "transform 180ms ease-in";
			panel.style.transform = "translateY(100%)";
			setTimeout(() => this._close(), 160);
		} else {
			panel.style.transition = "transform 180ms ease";
			panel.style.transform = "";
			setTimeout(() => {
				panel.style.transition = "";
			}, 200);
		}
	};

	private _patch(filters: SheetFilters): void {
		this._draft = filters;
	}

	private _setLocal(on: boolean): void {
		this._patch({ ...this._active, localOnly: on });
	}

	private _modeOf(filters: SheetFilters, dim: SheetDimension): FilterModalMode {
		return dim === "category" ? filters.categoryMode : filters.manufacturerMode;
	}

	private _setMode(dim: SheetDimension, mode: FilterModalMode): void {
		const filters = this._active;
		this._patch(
			dim === "category"
				? { ...filters, categoryMode: mode }
				: { ...filters, manufacturerMode: mode },
		);
	}

	private _toggle(dim: SheetDimension, id: string): void {
		const filters = this._active;
		const set = new Set(filters[dim]);
		if (set.has(id)) {
			set.delete(id);
		} else {
			set.add(id);
		}
		this._patch({ ...filters, [dim]: set });
	}

	private _clearDimension(dim: SheetDimension): void {
		this._patch({ ...this._active, [dim]: new Set() });
	}

	private _clearAll(): void {
		this._patch({
			...this._active,
			category: new Set(),
			manufacturer: new Set(),
			localOnly: false,
		});
	}

	private _activeCount(filters: SheetFilters): number {
		return (
			filters.category.size +
			filters.manufacturer.size +
			(filters.localOnly ? 1 : 0)
		);
	}

	private _summary(
		filters: SheetFilters,
		config: DimensionConfig,
	): string | null {
		const set = filters[config.dim];
		if (set.size === 0) {
			return null;
		}
		const label =
			set.size > 2
				? m.browse_sheet_selected_count({ count: set.size })
				: [...set]
						.map(
							(id) =>
								config.options.find((option) => option.id === id)?.label ?? id,
						)
						.join(", ");

		return this._modeOf(filters, config.dim) === "exclude"
			? m.browse_chip_not({ label })
			: label;
	}

	private _renderRoot(filters: SheetFilters) {
		return html`
			<div class="sheet-body sheet-list">
				<label class="sheet-row sheet-row-toggle">
					<span class="sheet-row-main">
						<span class="sheet-row-label">${m.browse_local_only_label()}</span>
						<span class="sheet-row-value">${m.browse_local_only_hint()}</span>
					</span>
					<span class=${"switch" + (filters.localOnly ? " is-on" : "")}>
						<input
							type="checkbox"
							.checked=${filters.localOnly}
							aria-label=${m.browse_local_only_label()}
							@change=${(e: Event) => this._setLocal((e.target as HTMLInputElement).checked)}
						/>
						<span class="switch-track"></span>
						<span class="switch-thumb"></span>
					</span>
				</label>
				${this._dimensions.map((config) => {
					const summary = this._summary(filters, config);
					return html`
						<button
							type="button"
							class="sheet-row"
							@click=${() => (this._subView = config.dim)}
						>
							<span class="sheet-row-main">
								<span class="sheet-row-label">${config.label}</span>
								${summary !== null ? html`<span class="sheet-row-value">${summary}</span>` : nothing}
							</span>
							${icon("arrow", 16)}
						</button>
					`;
				})}
			</div>
		`;
	}

	private _renderDimension(filters: SheetFilters, config: DimensionConfig) {
		const selected = filters[config.dim];
		const groups = groupOptions(
			config.options,
			this._query,
			config.letterGroups ? this._groupBy : "none",
		);
		const matchedCount = groups.reduce(
			(sum, [, options]) => sum + options.length,
			0,
		);

		return html`
			<div class="sheet-body">
				${
					matchedCount === 0
						? html`<div class="modal-empty">
								${m.browse_modal_no_matches({ term: this._query.trim() })}
							</div>`
						: groups.map(
								([letter, options]) => html`
									<section>
										${letter.length > 0 ? html`<div class="sheet-group-head">${letter}</div>` : nothing}
										<div>
											${options.map((option) => {
												const on = selected.has(option.id);
												return html`
													<button
														type="button"
														class=${"filter-tap-row" + (on ? " is-selected" : "")}
														aria-pressed=${on}
														@click=${() => this._toggle(config.dim, option.id)}
													>
														<span class="filter-tap-row-check">
															${on ? icon("check", 16) : nothing}
														</span>
														<span class="filter-tap-row-text"
															>${highlight(option.label, this._query)}</span
														>
														${
															typeof option.count !== "undefined"
																? html`<span class="filter-tap-row-count"
																		>${option.count.toLocaleString(getLocale())}</span
																	>`
																: nothing
														}
													</button>
												`;
											})}
										</div>
									</section>
								`,
							)
				}
			</div>
		`;
	}

	private _renderModeButton(
		dim: SheetDimension,
		filters: SheetFilters,
		mode: FilterModalMode,
		text: string,
	) {
		return html`
			<button
				type="button"
				class=${"filter-mode-btn" + (this._modeOf(filters, dim) === mode ? " is-active" : "")}
				aria-pressed=${this._modeOf(filters, dim) === mode}
				@click=${() => this._setMode(dim, mode)}
			>
				<span>${text}</span>
			</button>
		`;
	}

	override render() {
		if (!this._open) {
			return nothing;
		}
		const filters = this._active;
		const config =
			this._subView !== null
				? (this._dimensions.find((d) => d.dim === this._subView) ?? null)
				: null;
		const activeCount = this._activeCount(filters);

		return html`
			<div class="sheet-backdrop" role="presentation" @click=${this._close}>
				<div
					class="sheet-panel"
					role="dialog"
					aria-modal="true"
					aria-label=${m.browse_filters()}
					@click=${(e: Event) => e.stopPropagation()}
				>
					<div
						class="sheet-grabber"
						aria-hidden="true"
						@pointerdown=${this._onGrabStart}
						@pointermove=${this._onGrabMove}
						@pointerup=${this._onGrabEnd}
						@pointercancel=${this._onGrabEnd}
					>
						<span class="sheet-grabber-bar"></span>
					</div>
					<header class="sheet-head">
						<div class="sheet-head-row">
							${
								config !== null
									? html`<button
											class="sheet-back"
											aria-label=${m.browse_sheet_back()}
											@click=${() => (this._subView = null)}
										>
											${icon("arrowL", 18)}
										</button>`
									: html`<button
											class="sheet-back"
											aria-label=${m.browse_sheet_close()}
											@click=${this._close}
										>
											${icon("x", 18)}
										</button>`
							}
							<h2 class="sheet-title">
								${config !== null ? config.label : m.browse_filters()}
							</h2>
							${
								config !== null
									? html`<div
											class="filter-mode sheet-head-mode"
											role="group"
											aria-label=${m.browse_mode_label()}
										>
											${this._renderModeButton(config.dim, filters, "include", m.browse_mode_is())}
											${this._renderModeButton(config.dim, filters, "exclude", m.browse_mode_is_not())}
										</div>`
									: activeCount > 0
										? html`<button
												class="clear"
												@click=${() => this._clearAll()}
											>
												${m.browse_clear_all()}
											</button>`
										: nothing
							}
						</div>
						${
							config !== null
								? html`<div class="sheet-head-search">
										<div class="modal-search-input">
											${icon("search", 18)}
											<input
												type="search"
												.value=${this._query}
												placeholder=${config.searchPlaceholder}
												aria-label=${config.searchPlaceholder}
												@input=${(e: Event) => (this._query = (e.target as HTMLInputElement).value)}
											/>
										</div>
										${
											config.letterGroups
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
									</div>`
								: nothing
						}
					</header>

					${config !== null ? this._renderDimension(filters, config) : this._renderRoot(filters)}

					<footer class="sheet-foot">
						${
							config !== null
								? html`${
											filters[config.dim].size > 0
												? html`<button
														type="button"
														class="modal-foot-clear"
														@click=${() => this._clearDimension(config.dim)}
													>
														${m.browse_modal_clear_selected({
															count: filters[config.dim].size,
														})}
													</button>`
												: html`<span class="modal-foot-meta"
														>${config.emptyLabel}</span
													>`
										}
										<button
											class="btn btn-primary sheet-cta-inline"
											@click=${() => (this._subView = null)}
										>
											${m.browse_sheet_save()}
										</button>`
								: html`<button
										class="btn btn-primary sheet-cta"
										@click=${this._close}
									>
										${m.browse_sheet_show_results()}
									</button>`
						}
					</footer>
				</div>
			</div>
		`;
	}
}

defineElementOnce("filter-sheet", FilterSheet);

declare global {
	interface HTMLElementTagNameMap {
		"filter-sheet": FilterSheet;
	}
	interface WindowEventMap {
		"browse:open-sheet": CustomEvent<Record<string, never>>;
	}
}
