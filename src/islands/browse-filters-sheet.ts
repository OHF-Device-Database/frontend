import { navigate } from "astro:transitions/client"
import { LitElement, html, nothing } from "lit"
import { property, state } from "lit/decorators.js"
import { unsafeHTML } from "lit/directives/unsafe-html.js"
import {
  type BrowseFilters,
  type FacetDimension,
  type FilterMode,
  activeFilterCount,
  browseFiltersHref,
  categoryOptions,
  groupByLetter,
  parseBrowseFilters,
} from "../lib/browse-filters.js"
import { defineElementOnce } from "../lib/define-element.js"
import type { Category } from "../lib/device.js"
import { icon } from "../lib/icons.js"

interface DimensionConfig {
  dim: FacetDimension
  label: string
  options: Category[]
  letterGroups: boolean
}

export class BrowseFiltersSheet extends LitElement {
  @property({ type: Array }) manufacturers: string[] = []

  @state() private _open = false
  @state() private _subView: FacetDimension | null = null
  @state() private _query = ""

  private _onChange = () => this.requestUpdate()

  private _onOpenFilter = (e: CustomEvent<{ dim: FacetDimension }>) => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      this._openSheet(e.detail.dim)
    }
  }

  private _onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") {
      return
    }
    if (this._subView) {
      this._subView = null
    } else {
      this._close()
    }
  }

  protected createRenderRoot(): HTMLElement {
    return this
  }

  connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener("browse:filter-change", this._onChange)
    window.addEventListener("popstate", this._onChange)
    document.addEventListener("astro:page-load", this._onChange)
    window.addEventListener("browse:open-filter", this._onOpenFilter as EventListener)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener("browse:filter-change", this._onChange)
    window.removeEventListener("popstate", this._onChange)
    document.removeEventListener("astro:page-load", this._onChange)
    window.removeEventListener("browse:open-filter", this._onOpenFilter as EventListener)
    this._releaseBody()
  }

  private get _filters(): BrowseFilters {
    return parseBrowseFilters(new URLSearchParams(window.location.search))
  }

  private get _dimensions(): DimensionConfig[] {
    return [
      { dim: "category", label: "Category", options: categoryOptions(), letterGroups: false },
      {
        dim: "manufacturer",
        label: "Manufacturer",
        options: this.manufacturers.map((name) => ({ id: name, label: name })),
        letterGroups: true,
      },
    ]
  }

  private _commit(filters: BrowseFilters): void {
    navigate(browseFiltersHref(filters))
  }

  private _openSheet(subView: FacetDimension | null): void {
    this._open = true
    this._subView = subView
    this._query = ""
    document.body.classList.add("modal-open")
    document.addEventListener("keydown", this._onKey)
  }

  private _close(): void {
    this._open = false
    this._subView = null
    this._releaseBody()
    document.removeEventListener("keydown", this._onKey)
  }

  private _releaseBody(): void {
    document.body.classList.remove("modal-open")
  }

  private _setLocal(on: boolean): void {
    this._commit({ ...this._filters, localOnly: on })
  }

  private _setMode(dim: FacetDimension, mode: FilterMode): void {
    const filters = this._filters
    this._commit(
      dim === "category"
        ? { ...filters, categoryMode: mode }
        : { ...filters, manufacturerMode: mode },
    )
  }

  private _toggle(dim: FacetDimension, id: string): void {
    const filters = this._filters
    const set = new Set(filters[dim])
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    this._commit({ ...filters, [dim]: set })
  }

  private _clearDimension(dim: FacetDimension): void {
    this._commit({ ...this._filters, [dim]: new Set() })
  }

  private _clearAll(): void {
    this._commit({
      ...this._filters,
      category: new Set(),
      manufacturer: new Set(),
      localOnly: false,
    })
  }

  private _modeOf(filters: BrowseFilters, dim: FacetDimension): FilterMode {
    return dim === "category" ? filters.categoryMode : filters.manufacturerMode
  }

  private _summary(filters: BrowseFilters, config: DimensionConfig): string | null {
    const set = filters[config.dim]
    if (set.size === 0) {
      return null
    }
    const not = this._modeOf(filters, config.dim) === "exclude"
    if (set.size > 2) {
      return `${not ? "Not " : ""}${set.size} selected`
    }
    const labels = [...set].map((id) => config.options.find((o) => o.id === id)?.label ?? id)
    return `${not ? "Not " : ""}${labels.join(", ")}`
  }

  private _renderFab(filters: BrowseFilters) {
    const count = activeFilterCount(filters)
    return html`
      <div class="filters-fab-wrap">
        <div class="container">
          <button
            type="button"
            class="filters-fab"
            aria-label=${count ? `Filters, ${count} active` : "Filters"}
            @click=${() => this._openSheet(null)}
          >
            ${unsafeHTML(icon("search", 16))}
            <span
              >Filters${count > 0
                ? html`<span class="filters-fab-count"> · ${count}</span>`
                : nothing}</span
            >
          </button>
        </div>
      </div>
    `
  }

  private _renderRoot(filters: BrowseFilters) {
    return html`
      <div class="sheet-body sheet-list">
        <label class="sheet-row sheet-row-toggle">
          <span class="sheet-row-main">
            <span class="sheet-row-label">Local control only</span>
            <span class="sheet-row-value">Hide devices that need internet</span>
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
        ${this._dimensions.map((config) => {
          const summary = this._summary(filters, config)
          return html`
            <button type="button" class="sheet-row" @click=${() => (this._subView = config.dim)}>
              <span class="sheet-row-main">
                <span class="sheet-row-label">${config.label}</span>
                ${summary ? html`<span class="sheet-row-value">${summary}</span>` : nothing}
              </span>
              ${unsafeHTML(icon("arrow", 16))}
            </button>
          `
        })}
      </div>
    `
  }

  private _renderDimension(filters: BrowseFilters, config: DimensionConfig) {
    const selected = filters[config.dim]
    const term = this._query.trim().toLowerCase()
    const matched = term
      ? config.options.filter((o) => o.label.toLowerCase().includes(term))
      : config.options
    const groups = config.letterGroups ? groupByLetter(matched) : [["", matched] as const]

    return html`
      <div class="sheet-body">
        ${matched.length === 0
          ? html`<div class="modal-empty">No matches for “${this._query}”.</div>`
          : groups.map(
              ([letter, opts]) => html`
                <section class="modal-group">
                  ${letter ? html`<div class="modal-group-head">${letter}</div>` : nothing}
                  <div class="modal-group-rows">
                    ${opts.map((option) => {
                      const on = selected.has(option.id)
                      return html`
                        <button
                          type="button"
                          class=${"filter-tap-row" + (on ? " is-selected" : "")}
                          aria-pressed=${on}
                          @click=${() => this._toggle(config.dim, option.id)}
                        >
                          ${on
                            ? html`<span class="filter-tap-row-check"
                                >${unsafeHTML(icon("arrow", 16))}</span
                              >`
                            : nothing}
                          <span class="filter-tap-row-text">${option.label}</span>
                        </button>
                      `
                    })}
                  </div>
                </section>
              `,
            )}
      </div>
    `
  }

  render() {
    const filters = this._filters
    const config = this._subView ? this._dimensions.find((d) => d.dim === this._subView) : null
    const activeCount = activeFilterCount(filters)

    return html`
      ${this._renderFab(filters)}
      ${this._open
        ? html`
            <div class="sheet-backdrop" role="presentation" @click=${this._close}>
              <div
                class="sheet-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Filters"
                @click=${(e: Event) => e.stopPropagation()}
              >
                <header class="sheet-head">
                  <div class="sheet-head-row">
                    ${this._subView
                      ? html`<button
                          class="sheet-back"
                          aria-label="Back to filters"
                          @click=${() => (this._subView = null)}
                        >
                          ${unsafeHTML(icon("arrowL", 18))}
                        </button>`
                      : html`<button
                          class="sheet-back"
                          aria-label="Close filters"
                          @click=${this._close}
                        >
                          ${unsafeHTML(icon("x", 18))}
                        </button>`}
                    <h2 class="sheet-title">${config ? config.label : "Filters"}</h2>
                    ${this._subView && config
                      ? html`<div class="filter-mode sheet-head-mode" role="group">
                          <button
                            type="button"
                            class=${"filter-mode-btn" +
                            (this._modeOf(filters, config.dim) === "include" ? " is-active" : "")}
                            @click=${() => this._setMode(config.dim, "include")}
                          >
                            <span>is</span>
                          </button>
                          <button
                            type="button"
                            class=${"filter-mode-btn" +
                            (this._modeOf(filters, config.dim) === "exclude" ? " is-active" : "")}
                            @click=${() => this._setMode(config.dim, "exclude")}
                          >
                            <span>is not</span>
                          </button>
                        </div>`
                      : !this._subView && activeCount > 0
                        ? html`<button class="clear" @click=${this._clearAll}>Clear all</button>`
                        : nothing}
                  </div>
                  ${this._subView && config
                    ? html`<div class="sheet-head-search">
                        <div class="modal-search-input">
                          ${unsafeHTML(icon("search", 18))}
                          <input
                            type="search"
                            .value=${this._query}
                            placeholder=${`Search ${config.label.toLowerCase()}`}
                            @input=${(e: Event) =>
                              (this._query = (e.target as HTMLInputElement).value)}
                          />
                        </div>
                      </div>`
                    : nothing}
                </header>

                ${config ? this._renderDimension(filters, config) : this._renderRoot(filters)}

                <footer class="sheet-foot">
                  ${config
                    ? html`${filters[config.dim].size > 0
                          ? html`<button
                              type="button"
                              class="modal-foot-clear"
                              @click=${() => this._clearDimension(config.dim)}
                            >
                              Clear ${filters[config.dim].size} selected
                            </button>`
                          : html`<span class="modal-foot-meta"
                              >No ${config.label.toLowerCase()} selected</span
                            >`}
                        <button
                          class="btn btn-primary sheet-cta-inline"
                          @click=${() => (this._subView = null)}
                        >
                          Save
                        </button>`
                    : html`<button class="btn btn-primary sheet-cta" @click=${this._close}>
                        Show results
                      </button>`}
                </footer>
              </div>
            </div>
          `
        : nothing}
    `
  }
}

defineElementOnce("browse-filters-sheet", BrowseFiltersSheet)

declare global {
  interface HTMLElementTagNameMap {
    "browse-filters-sheet": BrowseFiltersSheet
  }
}
