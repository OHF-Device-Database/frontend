import { LitElement, html, nothing, type TemplateResult } from "lit"
import { state } from "lit/decorators.js"
import { unsafeHTML } from "lit/directives/unsafe-html.js"
import { defineElementOnce } from "../lib/define-element.js"
import { categoryGlyph } from "../lib/icons.js"
import { CATEGORY_LABEL } from "../lib/categories.js"
import {
  allDrafts,
  changedKeys,
  CONTRIBUTOR_FIELD_LABEL,
  getCurrentUser,
  getSubmissions,
  reviewSubmission,
  STATUS_LABEL,
  submitDraft,
  subscribe,
  type CommunityUser,
  type Draft,
  type Submission,
  type SubmissionStatus,
} from "../lib/community.js"

const COMMUNITY_FLAG = "community-edit"

type Folder = "drafts" | "all" | "pending" | "live" | "declined"

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function fieldSummary(keys: string[]): string {
  return keys
    .map((k) => CONTRIBUTOR_FIELD_LABEL[k as keyof typeof CONTRIBUTOR_FIELD_LABEL] ?? k)
    .join(", ")
}

export class YourEdits extends LitElement {
  @state() private _enabled = false
  @state() private _user: CommunityUser | null = null
  @state() private _folder: Folder = "drafts"
  @state() private _rev = 0

  private _unsubscribe: (() => void) | null = null

  private _onDemoState = () => {
    this._enabled = window.DemoState?.getExperiment(COMMUNITY_FLAG) ?? false
  }
  private _onCommunity = () => {
    this._user = getCurrentUser()
    this._rev++
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
    if (allDrafts().length === 0) {
      this._folder = "all"
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener("devicedb:demostate", this._onDemoState)
    this._unsubscribe?.()
  }

  private get _drafts(): Draft[] {
    void this._rev
    const me = this._user?.id
    return allDrafts().filter((d) => d.by === me)
  }

  private get _submissions(): Submission[] {
    void this._rev
    const me = this._user?.id
    return getSubmissions().filter((s) => s.by === me)
  }

  private _submitAll(): void {
    for (const draft of this._drafts) {
      submitDraft(draft.deviceId)
    }
    this._folder = "pending"
  }

  private _statusBadge(status: SubmissionStatus): TemplateResult {
    return html`<span class=${`ye-badge ye-badge-${status}`}>${STATUS_LABEL[status]}</span>`
  }

  private _draftRow(draft: Draft): TemplateResult {
    const keys = changedKeys(draft.fields)
    return html`
      <li class="ye-row">
        ${unsafeHTML(`<span class="ye-thumb">${categoryGlyph(draft.category, 28)}</span>`)}
        <div class="ye-row-body">
          <a class="ye-row-name" href=${`/device/${draft.deviceId}`}>${draft.deviceName}</a>
          <span class="ye-row-manu">${draft.manufacturer}</span>
          <span class="ye-row-fields">${fieldSummary(keys)}</span>
        </div>
        <div class="ye-row-meta">
          <span class="ye-badge ye-badge-draft">Draft</span>
          <span class="ye-row-time">edited ${timeAgo(draft.updatedAt)}</span>
          <a class="btn btn-secondary ye-row-action" href=${`/device/${draft.deviceId}`}>Continue</a>
        </div>
      </li>
    `
  }

  private _submissionRow(sub: Submission): TemplateResult {
    return html`
      <li class="ye-row">
        ${unsafeHTML(`<span class="ye-thumb">${categoryGlyph(sub.category, 28)}</span>`)}
        <div class="ye-row-body">
          <a class="ye-row-name" href=${`/device/${sub.deviceId}`}>${sub.deviceName}</a>
          <span class="ye-row-manu">${sub.manufacturer}</span>
          <span class="ye-row-fields">${fieldSummary(sub.changedKeys)} · PR #${sub.prNumber}</span>
        </div>
        <div class="ye-row-meta">
          ${this._statusBadge(sub.status)}
          <span class="ye-row-time">${timeAgo(sub.submittedAt)}</span>
          ${sub.status === "pending"
            ? html`<span class="ye-review">
                <button type="button" class="ye-review-btn ye-approve" @click=${() => reviewSubmission(sub.id, "live")}>
                  Approve
                </button>
                <button
                  type="button"
                  class="ye-review-btn ye-decline"
                  @click=${() => reviewSubmission(sub.id, "declined")}
                >
                  Decline
                </button>
              </span>`
            : nothing}
        </div>
      </li>
    `
  }

  private _folderButton(id: Folder, label: string, count: number): TemplateResult {
    return html`
      <button
        type="button"
        class=${"ye-folder" + (this._folder === id ? " is-active" : "")}
        @click=${() => (this._folder = id)}
      >
        <span>${label}</span>
        <span class="ye-folder-count">${count}</span>
      </button>
    `
  }

  private _renderDashboard(): TemplateResult {
    const drafts = this._drafts
    const subs = this._submissions
    const pending = subs.filter((s) => s.status === "pending")
    const live = subs.filter((s) => s.status === "live")
    const declined = subs.filter((s) => s.status === "declined")

    let rows: TemplateResult[]
    let empty = ""
    if (this._folder === "drafts") {
      rows = drafts.map((d) => this._draftRow(d))
      empty = "No drafts. Open a device and suggest an edit to start one."
    } else {
      const list =
        this._folder === "pending"
          ? pending
          : this._folder === "live"
            ? live
            : this._folder === "declined"
              ? declined
              : subs
      rows = list.map((s) => this._submissionRow(s))
      empty = "Nothing here yet."
    }

    return html`
      <div class="ye-layout">
        <nav class="ye-rail" aria-label="Edit folders">
          ${this._folderButton("drafts", "Drafts", drafts.length)}
          <hr class="ye-rail-sep" />
          ${this._folderButton("all", "All submitted", subs.length)}
          ${this._folderButton("pending", "Awaiting review", pending.length)}
          ${this._folderButton("live", "Live", live.length)}
          ${this._folderButton("declined", "Declined", declined.length)}
        </nav>
        <div class="ye-main">
          ${this._folder === "drafts" && drafts.length
            ? html`<div class="ye-toolbar">
                <button type="button" class="btn btn-primary" @click=${this._submitAll}>
                  Submit all (${drafts.length})
                </button>
              </div>`
            : nothing}
          ${this._folder === "pending" && pending.length
            ? html`<p class="ye-demo-note">
                Demo: there is no real reviewer, so approve or decline below to move an edit through its lifecycle.
              </p>`
            : nothing}
          ${rows.length
            ? html`<ul class="ye-list">
                ${rows}
              </ul>`
            : html`<p class="ye-empty">${empty}</p>`}
        </div>
      </div>
    `
  }

  render() {
    if (!this._enabled) {
      return html`<p class="ye-gate">
        Community editing is off. Turn it on from the Community editing experiment in the logo menu.
      </p>`
    }
    if (!this._user) {
      return html`<p class="ye-gate">
        Sign in to see your edits.
        <a class="btn btn-primary" href="/sign-in?return=/your-edits">Sign in</a>
      </p>`
    }
    return this._renderDashboard()
  }
}

defineElementOnce("your-edits", YourEdits)

declare global {
  interface HTMLElementTagNameMap {
    "your-edits": YourEdits
  }
}
