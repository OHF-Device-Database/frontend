import { LitElement, html } from "lit"
import { state } from "lit/decorators.js"
import { unsafeHTML } from "lit/directives/unsafe-html.js"
import { defineElementOnce } from "../lib/define-element.js"
import { signInDefault } from "../lib/community.js"

const GITHUB_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.33.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.77.11 3.06.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56C20.21 21.38 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z"/></svg>`
const PASSKEY_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="18" cy="9" r="2.5"/><path d="M18 11.5V18l-1.5 1.5L18 21"/></svg>`
const MAIL_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`

interface Provider {
  key: string
  icon: string
  label: string
  busy: string
}

const PROVIDERS: Provider[] = [
  { key: "github", icon: GITHUB_SVG, label: "Sign in with GitHub", busy: "Connecting to GitHub…" },
  { key: "passkey", icon: PASSKEY_SVG, label: "Sign in with a passkey", busy: "Waiting for your passkey…" },
  { key: "email", icon: MAIL_SVG, label: "Sign in with email", busy: "Connecting…" },
]

/* The design's auth-provider chooser. There is no real auth yet, so every
 * provider runs the same simulated handoff and signs in the default user. */
export class SignInForm extends LitElement {
  @state() private _pending: string | null = null

  private _timer: ReturnType<typeof setTimeout> | null = null

  protected createRenderRoot(): HTMLElement {
    return this
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    if (this._timer) clearTimeout(this._timer)
  }

  private _returnTo(): string {
    const param = new URLSearchParams(window.location.search).get("return")
    return param && param.startsWith("/") ? param : "/your-edits"
  }

  private _start(key: string): void {
    if (this._pending) {
      return
    }
    this._pending = key
    this._timer = setTimeout(() => {
      signInDefault()
      window.location.assign(this._returnTo())
    }, 900)
  }

  render() {
    return html`
      <div class="ce-auth-providers">
        ${PROVIDERS.map((p) => {
          const busy = this._pending === p.key
          return html`
            <button
              type="button"
              class=${"ce-auth-btn" + (busy ? " is-busy" : "")}
              ?disabled=${!!this._pending}
              aria-busy=${busy}
              @click=${() => this._start(p.key)}
            >
              ${busy ? html`<span class="ce-auth-spinner" aria-hidden="true"></span>` : unsafeHTML(p.icon)}
              <span>${busy ? p.busy : p.label}</span>
            </button>
          `
        })}
      </div>
    `
  }
}

defineElementOnce("sign-in-form", SignInForm)

declare global {
  interface HTMLElementTagNameMap {
    "sign-in-form": SignInForm
  }
}
