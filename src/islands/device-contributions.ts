import { LitElement, html, nothing, type TemplateResult } from "lit"
import { property, state } from "lit/decorators.js"
import { unsafeHTML } from "lit/directives/unsafe-html.js"
import { defineElementOnce } from "../lib/define-element.js"
import { icon } from "../lib/icons.js"
import {
  changedKeys,
  clearDraft,
  getCurrentUser,
  getDraft,
  hasContent,
  liveFields,
  saveDraft,
  submissionsForDevice,
  submitDraft,
  subscribe,
  type CommunityUser,
  type ContributorFields,
  type DeviceRef,
  type Reference,
} from "../lib/community.js"

const COMMUNITY_FLAG = "community-edit"

function emptyFields(): ContributorFields {
  return { description: "", references: [] }
}

function cloneFields(fields: ContributorFields): ContributorFields {
  return { description: fields.description, references: fields.references.map((r) => ({ ...r })) }
}

/* Client-rendered contributor overlay for a device page: the Overview and
 * References read sections plus the in-place edit mode. All state is local
 * (see lib/community.ts); the server never sees it. */
export class DeviceContributions extends LitElement {
  @property({ attribute: "device-id" }) deviceId = ""
  @property({ attribute: "device-name" }) deviceName = ""
  @property({ attribute: "device-manufacturer" }) deviceManufacturer = ""
  @property({ attribute: "device-category" }) deviceCategory = ""

  @state() private _enabled = false
  @state() private _user: CommunityUser | null = null
  @state() private _editing = false
  @state() private _justSubmitted = false
  @state() private _fields: ContributorFields = emptyFields()
  /** Bumped on store changes to force a re-read of live/draft/pending. */
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
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener("devicedb:demostate", this._onDemoState)
    this._unsubscribe?.()
  }

  private get _device(): DeviceRef {
    return {
      id: this.deviceId,
      name: this.deviceName,
      manufacturer: this.deviceManufacturer,
      category: this.deviceCategory,
    }
  }

  private get _live(): ContributorFields | null {
    void this._rev
    return liveFields(this.deviceId)
  }

  private get _myPending() {
    void this._rev
    const me = this._user?.id
    return submissionsForDevice(this.deviceId).find((s) => s.status === "pending" && s.by === me) ?? null
  }

  private _startEdit(): void {
    if (!this._user) {
      window.location.assign("/sign-in?return=" + encodeURIComponent(window.location.pathname))
      return
    }
    const draft = getDraft(this.deviceId)
    this._fields = draft ? cloneFields(draft.fields) : cloneFields(this._live ?? emptyFields())
    this._justSubmitted = false
    this._editing = true
  }

  private _commit(next: ContributorFields): void {
    this._fields = next
    saveDraft(this._device, next)
  }

  private _setDescription(value: string): void {
    this._commit({ ...this._fields, description: value })
  }

  private _setRef(index: number, patch: Partial<Reference>): void {
    const references = this._fields.references.map((r, i) => (i === index ? { ...r, ...patch } : r))
    this._commit({ ...this._fields, references })
  }

  private _addRef(): void {
    this._commit({ ...this._fields, references: [...this._fields.references, { label: "", url: "" }] })
  }

  private _removeRef(index: number): void {
    this._commit({ ...this._fields, references: this._fields.references.filter((_, i) => i !== index) })
  }

  private _discard(): void {
    clearDraft(this.deviceId)
    this._fields = emptyFields()
    this._editing = false
  }

  private _cancel(): void {
    this._editing = false
  }

  private _submit(): void {
    const submission = submitDraft(this.deviceId)
    if (submission) {
      this._editing = false
      this._justSubmitted = true
    }
  }

  /* ---------- read view ---------- */

  private _renderReferences(refs: Reference[]): TemplateResult {
    return html`
      <ul class="cm-ref-list">
        ${refs.map(
          (r) => html`
            <li>
              <a href=${r.url} target="_blank" rel="noopener" class="cm-ref-link">
                ${r.label || r.url} ${unsafeHTML(icon("open", 12))}
              </a>
            </li>
          `,
        )}
      </ul>
    `
  }

  private _renderRead(): TemplateResult {
    const live = this._live
    const pending = this._myPending
    const draft = getDraft(this.deviceId)
    const canEdit = this._enabled

    return html`
      ${live?.description
        ? html`<section class="article-section cm-section">
            <h2>Overview</h2>
            ${live.description
              .split(/\n{2,}/)
              .map((para) => html`<p>${para}</p>`)}
          </section>`
        : nothing}
      ${live && live.references.length
        ? html`<section class="article-section cm-section">
            <h2>References</h2>
            ${this._renderReferences(live.references)}
          </section>`
        : nothing}
      ${canEdit
        ? html`<div class="cm-contribute">
            ${pending
              ? html`<p class="cm-pending-note">
                  ${unsafeHTML(icon("pencil", 14))} Your edit is awaiting review.
                  <a href="/your-edits">View in Your edits</a>
                </p>`
              : nothing}
            ${draft && hasContent(draft.fields)
              ? html`<button type="button" class="btn btn-secondary" @click=${this._startEdit}>
                  ${unsafeHTML(icon("pencil", 14))} Continue your draft
                </button>`
              : html`<button type="button" class="btn btn-secondary" @click=${this._startEdit}>
                  ${unsafeHTML(icon("pencil", 14))} ${live ? "Suggest an edit" : "Add an overview"}
                </button>`}
            ${!this._user
              ? html`<span class="cm-contribute-hint">Sign in to contribute.</span>`
              : nothing}
          </div>`
        : nothing}
    `
  }

  /* ---------- edit view ---------- */

  private _renderEdit(): TemplateResult {
    const fields = this._fields
    const count = changedKeys(fields).length
    const dirty = hasContent(fields)

    return html`
      <section class="article-section cm-edit">
        <div class="cm-edit-head">
          <h2>Suggest an edit</h2>
          <p class="cm-edit-sub">
            Editing contributor fields for <b>${this.deviceName}</b>. Changes are saved as a draft as you type.
          </p>
        </div>

        <label class="cm-field">
          <span class="cm-field-label">Overview</span>
          <span class="cm-field-help">A few plain-language paragraphs about the device.</span>
          <textarea
            class="cm-textarea"
            rows="6"
            placeholder="What is this device, and what should a buyer know?"
            .value=${fields.description}
            @input=${(e: Event) => this._setDescription((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>

        <div class="cm-field">
          <span class="cm-field-label">References</span>
          <span class="cm-field-help">Links to documentation, datasheets, or community sources.</span>
          <div class="cm-ref-rows">
            ${fields.references.map(
              (r, i) => html`
                <div class="cm-ref-row">
                  <input
                    type="text"
                    class="cm-input"
                    placeholder="Label"
                    .value=${r.label}
                    @input=${(e: Event) => this._setRef(i, { label: (e.target as HTMLInputElement).value })}
                  />
                  <input
                    type="url"
                    class="cm-input"
                    placeholder="https://"
                    .value=${r.url}
                    @input=${(e: Event) => this._setRef(i, { url: (e.target as HTMLInputElement).value })}
                  />
                  <button
                    type="button"
                    class="cm-ref-remove"
                    aria-label="Remove reference"
                    @click=${() => this._removeRef(i)}
                  >
                    ${unsafeHTML(icon("x", 14))}
                  </button>
                </div>
              `,
            )}
          </div>
          <button type="button" class="cm-add-ref" @click=${this._addRef}>+ Add reference</button>
        </div>

        <div class="cm-action-bar">
          <span class="cm-change-count">${count} ${count === 1 ? "field changed" : "fields changed"}</span>
          <div class="cm-action-bar-btns">
            ${dirty
              ? html`<button type="button" class="btn btn-ghost cm-discard" @click=${this._discard}>Discard</button>`
              : nothing}
            <button type="button" class="btn btn-ghost" @click=${this._cancel}>Cancel</button>
            <button type="button" class="btn btn-primary" ?disabled=${!dirty} @click=${this._submit}>
              Submit for review
            </button>
          </div>
        </div>
      </section>
    `
  }

  render() {
    if (!this._enabled && !this._live) {
      // Feature off and nothing published — render nothing at all.
      return nothing
    }
    if (this._editing) {
      return this._renderEdit()
    }
    return html`
      ${this._justSubmitted
        ? html`<p class="cm-submitted-note">
            ${unsafeHTML(icon("check", 14))} Submitted for review. Track it in
            <a href="/your-edits">Your edits</a>.
          </p>`
        : nothing}
      ${this._renderRead()}
    `
  }
}

defineElementOnce("device-contributions", DeviceContributions)

declare global {
  interface HTMLElementTagNameMap {
    "device-contributions": DeviceContributions
  }
}
