import { LitElement, html, nothing } from "lit"
import { property, state } from "lit/decorators.js"
import { unsafeHTML } from "lit/directives/unsafe-html.js"
import { defineElementOnce } from "../lib/define-element.js"
import { icon } from "../lib/icons.js"

export interface VersionEntry {
  version: string
  current: boolean
  meta: string
}

export class VersionHistory extends LitElement {
  @property({ type: Array }) entries: VersionEntry[] = []
  @property() label = "Show version history"

  @state() private _open = false

  private _onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this._close()
    }
  }

  protected createRenderRoot(): HTMLElement {
    return this
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this._release()
  }

  private _openPanel(): void {
    this._open = true
    document.body.classList.add("modal-open")
    document.addEventListener("keydown", this._onKey)
  }

  private _close(): void {
    this._open = false
    this._release()
  }

  private _release(): void {
    document.body.classList.remove("modal-open")
    document.removeEventListener("keydown", this._onKey)
  }

  render() {
    if (this.entries.length === 0) {
      return nothing
    }
    return html`
      <button type="button" class="version-link" @click=${this._openPanel}>${this.label}</button>
      ${this._open
        ? html`
            <div class="vh-backdrop" role="presentation" @click=${this._close}>
              <div
                class="vh-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Version history"
                @click=${(e: Event) => e.stopPropagation()}
              >
                <header class="vh-head">
                  <button class="vh-close" aria-label="Close" @click=${this._close}>
                    ${unsafeHTML(icon("x", 18))}
                  </button>
                  <h2>Version history</h2>
                </header>
                <ol class="vh-timeline">
                  ${this.entries.map(
                    (entry) => html`
                      <li class=${"vh-item" + (entry.current ? " is-current" : "")}>
                        <span class="vh-dot"></span>
                        <div class="vh-body">
                          <div class="vh-ver">
                            <span class="mono">${entry.version}</span>
                            ${entry.current ? html`<span class="vh-badge">Current</span>` : nothing}
                          </div>
                          ${entry.meta ? html`<div class="vh-meta">${entry.meta}</div>` : nothing}
                        </div>
                      </li>
                    `,
                  )}
                </ol>
              </div>
            </div>
          `
        : nothing}
    `
  }
}

defineElementOnce("version-history", VersionHistory)

declare global {
  interface HTMLElementTagNameMap {
    "version-history": VersionHistory
  }
}
