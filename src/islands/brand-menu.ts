import { LitElement, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { defineElementOnce } from "../lib/define-element.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { icon } from "../lib/icons.js";
import { LOGO_SVG } from "../lib/logo.js";

interface DemoStateApi {
    getTheme(): string;
    setTheme(theme: string): void;
}

declare global {
    interface Window {
        DemoState?: DemoStateApi;
    }
}

const THEME_OPTIONS = [
    { id: "auto", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
];

const STAGES = [
    {
        key: "foundation",
        number: "01",
        label: "Foundation",
        hint: "Browse, search, and read device information. This is the baseline every later increment builds on.",
        locked: true,
    },
    {
        key: "community-edit",
        number: "02",
        label: "Community editing",
        hint: "Adds sign-in, account settings, a photo gallery on device pages, an edit mode for community members, and an edit history with attribution.",
        locked: false,
    },
];

const LONG_PRESS_MS = 600;

export class BrandMenu extends LitElement {
    @state() private _open = false;
    @state() private _theme = "auto";
    @state() private _osDark = false;
    @state() private _stages: Record<string, boolean> = {};

    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _fired = false;
    private _start: { x: number; y: number } | null = null;

    private _onState = () => {
        this._theme = window.DemoState?.getTheme() ?? "auto";
    };
    private _onOsChange = (e: MediaQueryListEvent) => {
        this._osDark = e.matches;
    };
    private _onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            this._close();
        }
    };

    protected createRenderRoot(): HTMLElement {
        return this;
    }

    connectedCallback(): void {
        super.connectedCallback();
        this._theme = window.DemoState?.getTheme() ?? "auto";
        this._osDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        window.addEventListener("devicedb:demostate", this._onState);
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", this._onOsChange);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener("devicedb:demostate", this._onState);
        window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", this._onOsChange);
        this._clearTimer();
    }

    private _clearTimer(): void {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    private _onPointerDown(e: PointerEvent): void {
        if (e.button > 0) {
            return;
        }
        this._fired = false;
        this._start = { x: e.clientX, y: e.clientY };
        this._clearTimer();
        this._timer = setTimeout(() => {
            this._timer = null;
            this._fired = true;
            this._open = true;
            document.body.classList.add("modal-open");
            document.addEventListener("keydown", this._onKey);
        }, LONG_PRESS_MS);
    }

    private _onPointerMove(e: PointerEvent): void {
        if (!this._start) {
            return;
        }
        if (Math.abs(e.clientX - this._start.x) > 10 || Math.abs(e.clientY - this._start.y) > 10) {
            this._clearTimer();
        }
    }

    private _endPress(): void {
        this._clearTimer();
        this._start = null;
    }

    private _onClick(e: MouseEvent): void {
        if (this._fired) {
            e.preventDefault();
            this._fired = false;
        }
    }

    private _close(): void {
        this._open = false;
        document.body.classList.remove("modal-open");
        document.removeEventListener("keydown", this._onKey);
    }

    private _pickTheme(id: string): void {
        this._theme = id;
        window.DemoState?.setTheme(id);
    }

    private _toggleStage(key: string): void {
        this._stages = { ...this._stages, [key]: !this._stages[key] };
    }

    private _renderDialog() {
        return html`
            <div class="modal-backdrop" role="presentation" @click=${this._close}>
                <div
                    class="exp-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Experiments"
                    @click=${(e: Event) => e.stopPropagation()}
                >
                    <header class="modal-head">
                        <div class="modal-head-row">
                            <button class="modal-close" aria-label="Close" @click=${this._close}>
                                ${unsafeHTML(icon("x", 18))}
                            </button>
                            <h2>Experiments</h2>
                        </div>
                    </header>
                    <div class="exp-body">
                        <p class="exp-intro">In-progress features. Settings are saved to this browser only.</p>

                        <section class="exp-section">
                            <h3 class="exp-section-title">Appearance</h3>
                            <div class="exp-seg" role="radiogroup" aria-label="Theme">
                                ${THEME_OPTIONS.map(
                                    (opt) => html`
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked=${this._theme === opt.id}
                                            class=${"exp-seg-btn" + (this._theme === opt.id ? " is-active" : "")}
                                            @click=${() => this._pickTheme(opt.id)}
                                        >
                                            ${opt.label}
                                        </button>
                                    `,
                                )}
                            </div>
                            <p class="exp-seg-meta">
                                ${this._theme === "auto"
                                    ? html`System preference: <b>${this._osDark ? "Dark" : "Light"}</b>`
                                    : html`Overrides system preference (currently
                                          <b>${this._osDark ? "Dark" : "Light"}</b>).`}
                            </p>
                        </section>

                        <section class="exp-section">
                            <h3 class="exp-section-title">Stages</h3>
                            <ul class="exp-list">
                                ${STAGES.map((it) => {
                                    const on = it.locked ? true : !!this._stages[it.key];
                                    const text = html`
                                        <div class="exp-row-text">
                                            <span class="exp-row-num">${it.number}</span>
                                            <span class="exp-row-name">${it.label}</span>
                                            <span class="exp-row-hint">${it.hint}</span>
                                        </div>
                                    `;
                                    return html`<li class="exp-item">
                                        ${it.locked
                                            ? html`<div class="exp-row">${text}</div>`
                                            : html`<label class="exp-row">
                                                  ${text}
                                                  <span class="exp-row-switch">
                                                      <span class=${"switch" + (on ? " is-on" : "")}>
                                                          <input
                                                              type="checkbox"
                                                              .checked=${on}
                                                              aria-label=${it.label}
                                                              @change=${() => this._toggleStage(it.key)}
                                                          />
                                                          <span class="switch-track"></span>
                                                          <span class="switch-thumb"></span>
                                                      </span>
                                                  </span>
                                              </label>`}
                                    </li>`;
                                })}
                            </ul>
                        </section>
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        return html`
            <a
                href="/"
                class="brand"
                aria-label="Device Database, home"
                @pointerdown=${this._onPointerDown}
                @pointermove=${this._onPointerMove}
                @pointerup=${this._endPress}
                @pointerleave=${this._endPress}
                @pointercancel=${this._endPress}
                @click=${this._onClick}
            >
                ${unsafeHTML(LOGO_SVG)}
            </a>
            ${this._open ? this._renderDialog() : nothing}
        `;
    }
}

defineElementOnce("brand-menu", BrandMenu);

declare global {
    interface HTMLElementTagNameMap {
        "brand-menu": BrandMenu;
    }
}
