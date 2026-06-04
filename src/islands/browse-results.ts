import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { defineElementOnce } from "../lib/define-element.js";
import type { Device } from "../lib/device.js";
import { applyFilters, parseBrowseFilters } from "../lib/browse-filters.js";
import { requiresInternet } from "../lib/device.js";
import { CATEGORY_LABEL } from "../lib/categories.js";
import { categoryGlyph } from "../lib/icons.js";

export class BrowseResults extends LitElement {
    @property({ type: Array }) devices: Device[] = [];

    @state() private _results: Device[] = [];

    private _sync = () => {
        const filters = parseBrowseFilters(new URLSearchParams(window.location.search));
        this._results = applyFilters(this.devices, filters).toSorted((a, b) => a.name.localeCompare(b.name));
        window.dispatchEvent(
            new CustomEvent("browse:count", {
                detail: { count: this._results.length },
            }),
        );
    };

    private _onFilterChange = () => this._sync();
    private _onPopState = () => this._sync();
    private _onPageLoad = () => this._sync();

    protected createRenderRoot(): HTMLElement {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        this._sync();
        window.addEventListener("browse:filter-change", this._onFilterChange);
        window.addEventListener("popstate", this._onPopState);
        document.addEventListener("astro:page-load", this._onPageLoad);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener("browse:filter-change", this._onFilterChange);
        window.removeEventListener("popstate", this._onPopState);
        document.removeEventListener("astro:page-load", this._onPageLoad);
    }

    render() {
        if (this._results.length === 0) {
            return html`<p class="browse-empty">No devices match these filters.</p>`;
        }

        return html`
            <div class="device-list">
                ${this._results.map(
                    (device) => html`
                        <a class="device-row" href="/device/${device.id}">
                            <div class="device-thumb">${unsafeHTML(categoryGlyph(device.category, 36))}</div>
                            <div class="device-row-body">
                                <div class="device-category">${CATEGORY_LABEL[device.category] ?? device.category}</div>
                                <div class="device-name">${device.name}</div>
                                <div class="device-manu">${device.manufacturer}</div>
                                <div class="device-status">
                                    <span
                                        class=${"local-indicator " +
                                        (requiresInternet(device) ? "net-yes" : "net-no")}
                                    >
                                        <span class="dot"></span>
                                        ${requiresInternet(device) ? "Requires internet" : "Local connection"}
                                    </span>
                                </div>
                            </div>
                        </a>
                    `,
                )}
            </div>
        `;
    }
}

defineElementOnce("browse-results", BrowseResults);
