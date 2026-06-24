import { LitElement, html, nothing } from "lit"
import { state } from "lit/decorators.js"
import { defineElementOnce } from "../lib/define-element.js"
import { getCurrentUser, signOut, subscribe, type CommunityUser } from "../lib/community.js"

const COMMUNITY_FLAG = "community-edit"

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

/* Sign-in entry point in the nav. Renders nothing until the Community editing
 * experiment is enabled. Sign-in itself lives on the /sign-in page. */
export class CommunityAuth extends LitElement {
  @state() private _enabled = false
  @state() private _user: CommunityUser | null = null
  @state() private _menuOpen = false

  private _unsubscribe: (() => void) | null = null

  private _onDemoState = () => {
    this._enabled = window.DemoState?.getExperiment(COMMUNITY_FLAG) ?? false
  }
  private _onCommunity = () => {
    this._user = getCurrentUser()
  }
  private _onDocClick = (e: MouseEvent) => {
    if (!this.contains(e.target as Node)) {
      this._menuOpen = false
    }
  }

  protected createRenderRoot(): HTMLElement {
    return this
  }

  connectedCallback(): void {
    super.connectedCallback()
    this._enabled = window.DemoState?.getExperiment(COMMUNITY_FLAG) ?? false
    this._user = getCurrentUser()
    window.addEventListener("devicedb:demostate", this._onDemoState)
    this._unsubscribe = subscribe(this._onCommunity)
    document.addEventListener("click", this._onDocClick)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener("devicedb:demostate", this._onDemoState)
    this._unsubscribe?.()
    document.removeEventListener("click", this._onDocClick)
  }

  private _signOut(): void {
    signOut()
    this._menuOpen = false
  }

  private _avatar(user: CommunityUser, size: number) {
    return html`<span
      class="cm-avatar"
      style=${`--cm-avatar-bg:${user.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px`}
      >${initials(user.name)}</span
    >`
  }

  render() {
    if (!this._enabled) {
      this.toggleAttribute("hidden", true)
      return nothing
    }
    this.toggleAttribute("hidden", false)

    if (!this._user) {
      return html`<a class="btn btn-secondary cm-signin-btn" href="/sign-in">Sign in</a>`
    }

    const user = this._user
    return html`
      <div class="cm-user">
        <button
          type="button"
          class="cm-user-btn"
          aria-haspopup="true"
          aria-expanded=${this._menuOpen}
          @click=${() => (this._menuOpen = !this._menuOpen)}
        >
          ${this._avatar(user, 30)}
        </button>
        ${this._menuOpen
          ? html`
              <div class="cm-menu" role="menu">
                <div class="cm-menu-head">
                  <span class="cm-menu-name">${user.name}</span>
                  <span class="cm-menu-login">@${user.login}</span>
                </div>
                <a class="cm-menu-item" role="menuitem" href="/your-edits">Your edits</a>
                <button type="button" class="cm-menu-item" role="menuitem" @click=${this._signOut}>Sign out</button>
              </div>
            `
          : nothing}
      </div>
    `
  }
}

defineElementOnce("community-auth", CommunityAuth)

declare global {
  interface HTMLElementTagNameMap {
    "community-auth": CommunityAuth
  }
}
