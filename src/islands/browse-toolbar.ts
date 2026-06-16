import { LitElement, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { navigate } from "astro:transitions/client";
import { defineElementOnce } from "../lib/define-element.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import {
    activeFilterChips,
    activeFilterCount,
    browseFiltersHref,
    clearedFilters,
    parseBrowseFilters,
    removeFilterChip,
    type FilterChip,
} from "../lib/browse-filters.js";
import { icon } from "../lib/icons.js";

export class BrowseToolbar extends LitElement {
    @property({ type: Number }) matchCount = 0;

    @state() private _count = 0;

    private _sync = () => {
        this._count = this.matchCount;
        this.requestUpdate();
    };

    private _onCount = (e: Event) => {
        this._count = (e as CustomEvent<{ count: number }>).detail.count;
    };

    private _onPageLoad = () => this._sync();
    private _onFilterChange = () => this.requestUpdate();

    protected createRenderRoot(): HTMLElement {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        this._count = this.matchCount;
        document.addEventListener("astro:page-load", this._onPageLoad);
        window.addEventListener("browse:filter-change", this._onFilterChange);
        window.addEventListener("browse:count", this._onCount as EventListener);
        window.addEventListener("popstate", this._onFilterChange);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener("astro:page-load", this._onPageLoad);
        window.removeEventListener("browse:filter-change", this._onFilterChange);
        window.removeEventListener("browse:count", this._onCount as EventListener);
        window.removeEventListener("popstate", this._onFilterChange);
    }

    private get _filters() {
        return parseBrowseFilters(new URLSearchParams(window.location.search));
    }

    private get _chips(): FilterChip[] {
        return activeFilterChips(this._filters);
    }

    private _remove(chip: FilterChip): void {
        navigate(browseFiltersHref(removeFilterChip(this._filters, chip)));
    }

    private _open(chip: FilterChip): void {
        if (chip.dim === "category" || chip.dim === "manufacturer") {
            window.dispatchEvent(new CustomEvent("browse:open-filter", { detail: { dim: chip.dim } }));
        }
    }

    private _clearAll(): void {
        navigate(browseFiltersHref(clearedFilters(this._filters)));
    }

    render() {
        const chips = this._chips;
        const count = this._count;
        const active = activeFilterCount(this._filters) > 0;

        return html`
            <div class="browse-toolbar">
                <div class="browse-toolbar-filters">
                    <h2 class="browse-toolbar-title">Filters</h2>
                    ${active
                        ? html`<button type="button" class="browse-toolbar-clear" @click=${this._clearAll}>
                              Clear all
                          </button>`
                        : nothing}
                </div>
                <div class="browse-toolbar-main">
                    <div class="browse-toolbar-chips">
                        ${chips.map((chip) =>
                            chip.summary
                                ? html`<button
                                      type="button"
                                      class="filter-chip filter-chip-summary"
                                      aria-label=${`Edit ${chip.label}`}
                                      @click=${() => this._open(chip)}
                                  >
                                      <span class="filter-chip-label">${chip.label}</span>
                                      ${unsafeHTML(icon("pencil", 12))}
                                  </button>`
                                : html`<span class="filter-chip">
                                      <span class="filter-chip-label">${chip.label}</span>
                                      <button
                                          type="button"
                                          class="filter-chip-remove"
                                          aria-label=${`Remove ${chip.label}`}
                                          @click=${() => this._remove(chip)}
                                      >
                                          ${unsafeHTML(icon("x", 12))}
                                      </button>
                                  </span>`,
                        )}
                    </div>
                    <p class="browse-match-count">
                        <b>${count.toLocaleString()}</b> ${count === 1 ? "device matches" : "devices match"}
                    </p>
                </div>
            </div>
        `;
    }
}

defineElementOnce("browse-toolbar", BrowseToolbar);

declare global {
    interface HTMLElementTagNameMap {
        "browse-toolbar": BrowseToolbar;
    }
}
