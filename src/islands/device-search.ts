import { LitElement, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { defineElementOnce } from "../lib/define-element.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { navigate } from "astro:transitions/client";
import { icon, categoryGlyph } from "../lib/icons.js";
import {
    buildSuggestions,
    countMatchingQuickFilter,
    QUICK_FILTERS,
    type QuickFilter,
    type Suggestions,
} from "../lib/search.js";
import type { Category, Device } from "../lib/device.js";

const SECTION_LABEL: Record<string, string> = {
    categories: "Categories",
    devices: "Devices",
    manufacturers: "Manufacturers",
    words: "Suggestions",
    quick: "Quick filters",
};

type Row =
    | { header: true; section: string }
    | { kind: "category"; value: Category }
    | { kind: "device"; value: Device }
    | { kind: "device-more"; value: { count: number; term: string } }
    | { kind: "manufacturer"; value: string }
    | { kind: "word"; value: string }
    | { kind: "quick-filter"; value: QuickFilter & { count: number } };

const FS_QUERY = "(max-width: 1023px)";

export class DeviceSearch extends LitElement {
    @property() size: "header" | "hero" = "header";
    @property() placeholder = "Search";

    @state() private _q = "";
    @state() private _open = false;
    @state() private _activeIdx = -1;
    @state() private _fullscreen = false;
    @state() private _fsScrolled = false;

    private _onDocPointer = (event: MouseEvent) => {
        if (this._fullscreen) {
            return;
        }
        const wrap = this.querySelector(".searchbox");
        if (wrap && !wrap.contains(event.target as Node)) {
            this._open = false;
        }
    };

    private _onPopState = () => {
        this._closeFullscreen({ fromPopState: true });
    };

    protected createRenderRoot(): HTMLElement {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener("mousedown", this._onDocPointer);
        window.addEventListener("popstate", this._onPopState);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener("mousedown", this._onDocPointer);
        window.removeEventListener("popstate", this._onPopState);
        this._releaseBody();
    }

    private get _isEmpty(): boolean {
        return this._q.trim().length === 0;
    }

    private get _suggestions(): Suggestions | null {
        return buildSuggestions(this._q);
    }

    private get _rows(): { rows: Row[]; selectable: Row[] } {
        const rows: Row[] = [];
        const selectable: Row[] = [];
        const push = (row: Row, isSelectable = true) => {
            rows.push(row);
            if (isSelectable && !("header" in row)) {
                selectable.push(row);
            }
        };

        if (this._isEmpty) {
            const quick = QUICK_FILTERS.map((qf) => ({
                ...qf,
                count: countMatchingQuickFilter(qf.filters),
            }));
            if (quick.length) {
                rows.push({ header: true, section: "quick" });
                for (const qf of quick) {
                    push({ kind: "quick-filter", value: qf });
                }
            }
            return { rows, selectable };
        }

        const s = this._suggestions;
        if (!s) {
            return { rows, selectable };
        }

        if (s.categories?.length) {
            rows.push({ header: true, section: "categories" });
            for (const value of s.categories) {
                push({ kind: "category", value });
            }
        }
        if (s.devices?.length) {
            rows.push({ header: true, section: "devices" });
            for (const value of s.devices) {
                push({ kind: "device", value });
            }
            if (s.deviceMore) {
                push({ kind: "device-more", value: { count: s.deviceMore, term: this._q.trim() } });
            }
        }
        if (s.manufacturers?.length) {
            rows.push({ header: true, section: "manufacturers" });
            for (const value of s.manufacturers) {
                push({ kind: "manufacturer", value });
            }
        }
        if (s.words?.length) {
            rows.push({ header: true, section: "words" });
            for (const value of s.words) {
                push({ kind: "word", value });
            }
        }
        return { rows, selectable };
    }

    private get _showDropdown(): boolean {
        const { selectable } = this._rows;
        return this._open && selectable.length > 0;
    }

    private _goBrowse(params: Record<string, string>): void {
        const qs = new URLSearchParams(params).toString();
        navigate(`/browse${qs ? "?" + qs : ""}`);
    }

    private _goBrowseFilters(filters: QuickFilter["filters"]): void {
        const p = new URLSearchParams();
        for (const v of filters.category ?? []) {
            p.append("category", v);
        }
        for (const v of filters.manufacturer ?? []) {
            p.append("manufacturer", v);
        }
        if (filters.localOnly) {
            p.set("local", "1");
        }
        const qs = p.toString();
        navigate(`/browse${qs ? "?" + qs : ""}`);
    }

    private _select(row: Row): void {
        if ("header" in row) {
            return;
        }
        this._open = false;
        this._closeFullscreen();
        this._q = "";
        switch (row.kind) {
            case "category":
                this._goBrowse({ category: row.value.id });
                break;
            case "device":
                navigate(`/device/${row.value.id}`);
                break;
            case "device-more":
                this._goBrowse({ q: row.value.term });
                break;
            case "manufacturer":
                this._goBrowse({ manufacturer: row.value });
                break;
            case "word":
                this._goBrowse({ q: row.value });
                break;
            case "quick-filter":
                this._goBrowseFilters(row.value.filters);
                break;
        }
    }

    private _onSubmit(event: Event): void {
        event.preventDefault();
        const { selectable } = this._rows;
        if (this._activeIdx >= 0 && this._activeIdx < selectable.length) {
            this._select(selectable[this._activeIdx]);
            return;
        }
        const term = this._q.trim();
        if (!term) {
            return;
        }
        this._open = false;
        this._closeFullscreen();
        this._q = "";
        this._goBrowse({ q: term });
    }

    private _onKeyDown(event: KeyboardEvent): void {
        const { selectable } = this._rows;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            this._open = true;
            this._activeIdx = Math.min(selectable.length - 1, this._activeIdx + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            this._activeIdx = Math.max(-1, this._activeIdx - 1);
        } else if (event.key === "Escape") {
            this._open = false;
            this._closeFullscreen();
        }
    }

    private _onInput(event: Event): void {
        this._q = (event.target as HTMLInputElement).value;
        this._open = true;
        this._activeIdx = -1;
        this._fsScrolled = false;
    }

    private _onFocus(fromFs: boolean): void {
        this._open = true;
        if (!fromFs) {
            this._openFullscreen();
        }
    }

    private _matchesFs(): boolean {
        return window.matchMedia(FS_QUERY).matches;
    }

    private _openFullscreen(): void {
        if (this._fullscreen || !this._matchesFs()) {
            return;
        }
        this._fullscreen = true;
        document.body.classList.add("search-fullscreen-open");
        try {
            window.history.pushState({ searchFs: true }, "");
        } catch (e) {}
        this.updateComplete.then(() => {
            this.querySelector<HTMLInputElement>(".searchbox-fs input")?.focus();
        });
    }

    private _closeFullscreen(opts: { fromPopState?: boolean } = {}): void {
        if (!this._fullscreen) {
            return;
        }
        this._fullscreen = false;
        this._open = false;
        this._releaseBody();
        if (!opts.fromPopState) {
            try {
                window.history.back();
            } catch (e) {}
        }
    }

    private _releaseBody(): void {
        document.body.classList.remove("search-fullscreen-open");
    }

    private _clear(): void {
        this._q = "";
        this._open = false;
        this.updateComplete.then(() => {
            this.querySelector<HTMLInputElement>("input")?.focus();
        });
    }

    private _renderForm(isFs: boolean) {
        const iconSize = this.size === "hero" && !isFs ? 22 : 18;
        return html`
            <form
                class="searchbox-input"
                role="search"
                @submit=${this._onSubmit}
                @click=${(e: MouseEvent) => {
                    if (e.target === e.currentTarget) {
                        (e.currentTarget as HTMLElement).querySelector("input")?.focus();
                    }
                }}
            >
                ${unsafeHTML(icon("search", iconSize))}
                <input
                    type="search"
                    .value=${this._q}
                    placeholder=${this.placeholder}
                    aria-label="Search devices"
                    aria-autocomplete="list"
                    aria-expanded=${this._showDropdown}
                    @input=${this._onInput}
                    @focus=${() => this._onFocus(isFs)}
                    @keydown=${this._onKeyDown}
                />
                ${this._q
                    ? html`<button
                          type="button"
                          class="appnav-search-clear"
                          aria-label="Clear search"
                          @click=${this._clear}
                      >
                          Clear
                      </button>`
                    : nothing}
            </form>
        `;
    }

    private _renderRows() {
        const { rows } = this._rows;
        const term = this._q.trim();
        let selIdx = -1;
        return rows.map((row) => {
            if ("header" in row) {
                return html`<div class="searchbox-section">${SECTION_LABEL[row.section]}</div>`;
            }
            selIdx += 1;
            const localSel = selIdx;
            const active = localSel === this._activeIdx;
            return html`
                <button
                    type="button"
                    class=${"searchbox-row" + (active ? " active" : "")}
                    role="option"
                    aria-selected=${active}
                    @mouseenter=${() => (this._activeIdx = localSel)}
                    @mousedown=${(e: MouseEvent) => {
                        e.preventDefault();
                        this._select(row);
                    }}
                >
                    ${this._renderRowContent(row, term)}
                </button>
            `;
        });
    }

    private _renderRowContent(row: Exclude<Row, { header: true }>, term: string) {
        switch (row.kind) {
            case "category":
                return html`${unsafeHTML(categoryGlyph(row.value.id, 18))}
                    <span class="searchbox-row-main">${this._highlight(row.value.label, term)}</span>
                    <span class="searchbox-row-meta">Category</span>`;
            case "device":
                return html`${unsafeHTML(categoryGlyph(row.value.category, 18))}
                    <span class="searchbox-row-main">${this._highlight(row.value.name, term)}</span>
                    <span class="searchbox-row-meta">${row.value.manufacturer}</span>`;
            case "device-more":
                return html`${unsafeHTML(icon("arrow", 16))}
                    <span class="searchbox-row-main searchbox-more-text"
                        >See all ${row.value.count} results for “${row.value.term}”</span
                    >`;
            case "manufacturer":
                return html`${unsafeHTML(icon("users", 16))}
                    <span class="searchbox-row-main">${this._highlight(row.value, term)}</span>
                    <span class="searchbox-row-meta">Manufacturer</span>`;
            case "quick-filter":
                return html`${unsafeHTML(categoryGlyph(row.value.icon, 18))}
                    <span class="searchbox-row-main">${row.value.title}</span>
                    <span class="searchbox-row-meta"
                        >${row.value.count} ${row.value.count === 1 ? "device" : "devices"}</span
                    >`;
            case "word":
                return html`${unsafeHTML(icon("search", 16))}
                    <span class="searchbox-row-main">${this._highlight(row.value, term)}</span>`;
        }
    }

    private _highlight(text: string, term: string) {
        if (!term) {
            return text;
        }
        const i = text.toLowerCase().indexOf(term.toLowerCase());
        if (i < 0) {
            return text;
        }
        return html`${text.slice(0, i)}<mark>${text.slice(i, i + term.length)}</mark>${text.slice(
            i + term.length,
        )}`;
    }

    render() {
        return html`
            <div class=${"searchbox searchbox-" + this.size}>
                ${this._renderForm(false)}
                ${this._showDropdown && !this._fullscreen
                    ? html`<div class="searchbox-dropdown" role="listbox">${this._renderRows()}</div>`
                    : nothing}
            </div>
            ${this._fullscreen
                ? html`
                      <div class="searchbox-fs">
                          <div class="searchbox-fs-bg" aria-hidden="true"></div>
                          <button
                              type="button"
                              class="searchbox-fs-back"
                              aria-label="Close search"
                              @mousedown=${(e: MouseEvent) => {
                                  e.preventDefault();
                                  this._closeFullscreen();
                              }}
                          >
                              ${unsafeHTML(icon("arrowL", 20))}
                          </button>
                          ${this._renderForm(true)}
                          ${this._showDropdown
                              ? html`<div
                                    class=${"searchbox-dropdown" + (this._fsScrolled ? " is-scrolled" : "")}
                                    role="listbox"
                                    @scroll=${(e: Event) => {
                                        this._fsScrolled = (e.currentTarget as HTMLElement).scrollTop > 0;
                                    }}
                                >
                                    ${this._renderRows()}
                                </div>`
                              : nothing}
                      </div>
                  `
                : nothing}
        `;
    }
}

defineElementOnce("device-search", DeviceSearch);

declare global {
    interface HTMLElementTagNameMap {
        "device-search": DeviceSearch;
    }
}
