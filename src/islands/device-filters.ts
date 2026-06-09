import { LitElement, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { defineElementOnce } from "../lib/define-element.js";
import { icon } from "../lib/icons.js";
import type { Category, Device } from "../lib/device.js";
import {
    type BrowseFilters,
    type FacetDimension,
    type FilterMode,
    browseFiltersHref,
    categoryOptions,
    facetCounts,
    frequencyCounts,
    groupByLetter,
    manufacturerOptions,
    parseBrowseFilters,
    topOptions,
    FACET_SIDEBAR_LIMIT,
} from "../lib/browse-filters.js";

interface DimensionConfig {
    dim: FacetDimension;
    label: string;
    options: Category[];
    letterGroups: boolean;
}

export class DeviceFilters extends LitElement {
    @property({ type: Array }) devices: Device[] = [];

    @state() private _moreDim: FacetDimension | null = null;
    @state() private _moreQuery = "";

    private _onChange = () => this.requestUpdate();

    protected createRenderRoot(): HTMLElement {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        window.addEventListener("browse:filter-change", this._onChange);
        window.addEventListener("popstate", this._onChange);
        document.addEventListener("astro:page-load", this._onChange);
        window.addEventListener("browse:open-filter", this._onOpenFilter as EventListener);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener("browse:filter-change", this._onChange);
        window.removeEventListener("popstate", this._onChange);
        document.removeEventListener("astro:page-load", this._onChange);
        window.removeEventListener("browse:open-filter", this._onOpenFilter as EventListener);
    }

    private _onOpenFilter = (e: CustomEvent<{ dim: FacetDimension }>) => {
        if (window.matchMedia("(min-width: 768px)").matches) {
            this._openMore(e.detail.dim);
        }
    };

    private get _filters(): BrowseFilters {
        return parseBrowseFilters(new URLSearchParams(window.location.search));
    }

    private get _dimensions(): DimensionConfig[] {
        return [
            { dim: "category", label: "Category", options: categoryOptions(), letterGroups: false },
            {
                dim: "manufacturer",
                label: "Manufacturer",
                options: manufacturerOptions(this.devices),
                letterGroups: true,
            },
        ];
    }

    private _commit(filters: BrowseFilters): void {
        history.pushState(null, "", browseFiltersHref(filters));
        window.dispatchEvent(new CustomEvent("browse:filter-change"));
    }

    private _setLocal(on: boolean): void {
        this._commit({ ...this._filters, localOnly: on });
    }

    private _setMode(dim: FacetDimension, mode: FilterMode): void {
        const filters = this._filters;
        this._commit(
            dim === "category"
                ? { ...filters, categoryMode: mode }
                : { ...filters, manufacturerMode: mode },
        );
    }

    private _toggle(dim: FacetDimension, id: string): void {
        const filters = this._filters;
        const set = new Set(filters[dim]);
        if (set.has(id)) {
            set.delete(id);
        } else {
            set.add(id);
        }
        this._commit({ ...filters, [dim]: set });
    }

    private _clearDimension(dim: FacetDimension): void {
        this._commit({ ...this._filters, [dim]: new Set() });
    }

    private _openMore(dim: FacetDimension): void {
        this._moreDim = dim;
        this._moreQuery = "";
        document.body.classList.add("modal-open");
    }

    private _closeMore(): void {
        this._moreDim = null;
        document.body.classList.remove("modal-open");
    }

    private _modeOf(filters: BrowseFilters, dim: FacetDimension): FilterMode {
        return dim === "category" ? filters.categoryMode : filters.manufacturerMode;
    }

    private _renderModeToggle(dim: FacetDimension, mode: FilterMode) {
        return html`
            <div class="filter-mode" role="group" aria-label="Filter mode">
                <button
                    type="button"
                    class=${"filter-mode-btn" + (mode === "include" ? " is-active" : "")}
                    aria-pressed=${mode === "include"}
                    @click=${() => this._setMode(dim, "include")}
                >
                    <span>is</span>
                </button>
                <button
                    type="button"
                    class=${"filter-mode-btn" + (mode === "exclude" ? " is-active" : "")}
                    aria-pressed=${mode === "exclude"}
                    @click=${() => this._setMode(dim, "exclude")}
                >
                    <span>is not</span>
                </button>
            </div>
        `;
    }

    private _renderRow(dim: FacetDimension, option: Category, selected: Set<string>, count: number) {
        return html`
            <label class="filter-row">
                <input
                    type="checkbox"
                    .checked=${selected.has(option.id)}
                    @change=${() => this._toggle(dim, option.id)}
                />
                <span class="filter-row-text">${option.label}</span>
                <span class="count">${count}</span>
            </label>
        `;
    }

    private _renderGroup(config: DimensionConfig, filters: BrowseFilters) {
        const selected = filters[config.dim];
        const counts = facetCounts(this.devices, filters, config.dim);
        const freq = frequencyCounts(this.devices, config.dim);
        const visible = topOptions(config.options, freq, selected, FACET_SIDEBAR_LIMIT);
        const hasMore = config.options.length > visible.length;
        return html`
            <div class="filter-group">
                <div class="filter-group-head">
                    <div class="filter-group-label">${config.label}</div>
                    ${this._renderModeToggle(config.dim, this._modeOf(filters, config.dim))}
                </div>
                <div class="filter-options">
                    ${visible.map((option) =>
                        this._renderRow(config.dim, option, selected, counts.get(option.id) ?? 0),
                    )}
                    ${hasMore
                        ? html`<button type="button" class="filter-more" @click=${() => this._openMore(config.dim)}>
                              ${unsafeHTML(icon("search", 16))}<span>More</span>
                          </button>`
                        : nothing}
                </div>
            </div>
        `;
    }

    private _renderMore(filters: BrowseFilters) {
        const config = this._dimensions.find((d) => d.dim === this._moreDim);
        if (!config) {
            return nothing;
        }
        const selected = filters[config.dim];
        const counts = facetCounts(this.devices, filters, config.dim);
        const term = this._moreQuery.trim().toLowerCase();
        const matched = term
            ? config.options.filter((o) => o.label.toLowerCase().includes(term))
            : config.options;
        const groups = config.letterGroups ? groupByLetter(matched) : [["", matched] as const];

        return html`
            <div class="modal-backdrop" role="presentation" @click=${this._closeMore}>
                <div
                    class="modal-dialog modal-tall"
                    role="dialog"
                    aria-modal="true"
                    aria-label=${config.label}
                    @click=${(e: Event) => e.stopPropagation()}
                >
                    <header class="modal-head">
                        <div class="modal-head-row">
                            <button class="modal-close" aria-label="Close" @click=${this._closeMore}>
                                ${unsafeHTML(icon("x", 18))}
                            </button>
                            <h2>${config.label}</h2>
                            ${this._renderModeToggle(config.dim, this._modeOf(filters, config.dim))}
                        </div>
                        <div class="modal-head-search">
                            <div class="modal-search-input">
                                ${unsafeHTML(icon("search", 18))}
                                <input
                                    type="search"
                                    .value=${this._moreQuery}
                                    placeholder=${`Search ${config.label.toLowerCase()}`}
                                    aria-label=${`Search ${config.label.toLowerCase()}`}
                                    @input=${(e: Event) => (this._moreQuery = (e.target as HTMLInputElement).value)}
                                />
                            </div>
                        </div>
                    </header>
                    <div class="modal-body">
                        ${matched.length === 0
                            ? html`<div class="modal-empty">No matches for “${this._moreQuery}”.</div>`
                            : groups.map(
                                  ([letter, opts]) => html`
                                      <section class="modal-group">
                                          ${letter
                                              ? html`<div class="modal-group-head">${letter}</div>`
                                              : nothing}
                                          <div class="modal-group-rows">
                                              ${opts.map((option) =>
                                                  this._renderRow(
                                                      config.dim,
                                                      option,
                                                      selected,
                                                      counts.get(option.id) ?? 0,
                                                  ),
                                              )}
                                          </div>
                                      </section>
                                  `,
                              )}
                    </div>
                    <footer class="modal-foot">
                        ${selected.size === 0
                            ? html`<span class="modal-foot-meta">No ${config.label.toLowerCase()} selected</span>`
                            : html`<button
                                  type="button"
                                  class="modal-foot-clear"
                                  @click=${() => this._clearDimension(config.dim)}
                              >
                                  Clear ${selected.size} selected
                              </button>`}
                        <button class="btn btn-primary" @click=${this._closeMore}>View results</button>
                    </footer>
                </div>
            </div>
        `;
    }

    render() {
        const filters = this._filters;
        return html`
            <aside class="filters" aria-label="Filters">
                <div class="local-only-toggle">
                    <label class="local-only-toggle-row">
                        <span class="local-only-toggle-text">
                            <span class="local-only-toggle-label">Local control only</span>
                            <span class="local-only-toggle-hint"
                                >Hide devices that need an internet connection</span
                            >
                        </span>
                        <span class=${"switch" + (filters.localOnly ? " is-on" : "")}>
                            <input
                                type="checkbox"
                                .checked=${filters.localOnly}
                                aria-label="Local control only"
                                @change=${(e: Event) => this._setLocal((e.target as HTMLInputElement).checked)}
                            />
                            <span class="switch-track"></span>
                            <span class="switch-thumb"></span>
                        </span>
                    </label>
                </div>
                ${this._dimensions.map((config) => this._renderGroup(config, filters))}
            </aside>
            ${this._moreDim ? this._renderMore(filters) : nothing}
        `;
    }
}

defineElementOnce("device-filters", DeviceFilters);

declare global {
    interface HTMLElementTagNameMap {
        "device-filters": DeviceFilters;
    }
    interface WindowEventMap {
        "browse:open-filter": CustomEvent<{ dim: FacetDimension }>;
    }
}
