import { navigate } from "astro:transitions/client"
import { html, LitElement, nothing } from "lit"
import { property, state } from "lit/decorators.js"
import { unsafeHTML } from "lit/directives/unsafe-html.js"
import { defineElementOnce } from "../lib/define-element.js"
import type { Category } from "../lib/device.js"
import { categoryGlyph, icon } from "../lib/icons.js"
import {
  fetchSuggestions,
  QUICK_FILTERS,
  type QuickFilter,
  type SuggestDevice,
  type Suggestions,
} from "../lib/search.js"

const SECTION_LABEL: Record<string, string> = {
  categories: "Categories",
  devices: "Devices",
  manufacturers: "Manufacturers",
  words: "Suggestions",
  quick: "Quick filters",
}

type Row =
  | { header: true; section: string }
  | { kind: "category"; value: Category }
  | { kind: "device"; value: SuggestDevice }
  | { kind: "device-more"; value: { count: number; term: string } }
  | { kind: "manufacturer"; value: string }
  | { kind: "quick-filter"; value: QuickFilter }

const FS_QUERY = "(max-width: 1023px)"

// Progressive enhancement: the search field itself is server-rendered (see SearchBox.astro)
// so the logo/search chrome is visible instantly without waiting for this bundle. This element
// enhances that markup in place — it binds behaviour to the existing <input> and renders only
// the dynamic parts (the suggestions dropdown and the mobile fullscreen overlay).
export class DeviceSearch extends LitElement {
  @property() size: "header" | "hero" = "header"
  @property() placeholder = "Search"

  @state() private _q = ""
  @state() private _open = false
  @state() private _activeIdx = -1
  @state() private _fullscreen = false
  @state() private _fsScrolled = false
  @state() private _suggestions: Suggestions | null = null

  private _suggestTimer?: ReturnType<typeof setTimeout>
  private _suggestAbort?: AbortController
  private _suggestSeq = 0

  // The server-rendered field we enhance (looked up on connect, not rendered by us).
  private _input: HTMLInputElement | null = null
  private _clearBtn: HTMLButtonElement | null = null

  private _onDocPointer = (event: MouseEvent) => {
    if (this._fullscreen) {
      return
    }
    const wrap = this.querySelector(".searchbox")
    if (wrap && !wrap.contains(event.target as Node)) {
      this._open = false
    }
  }

  private _onPopState = () => {
    this._closeFullscreen({ fromPopState: true })
  }

  private _onResize = () => this._sizeDropdown()

  // Render the dynamic overlay (dropdown + fullscreen) inside .searchbox so the absolutely
  // positioned dropdown anchors to it, while leaving the server-rendered form untouched.
  // display:contents keeps the wrapper from affecting layout when empty.
  protected createRenderRoot(): HTMLElement {
    const root = document.createElement("div")
    root.style.display = "contents"
    ;(this.querySelector(".searchbox") ?? this).appendChild(root)
    return root
  }

  connectedCallback(): void {
    super.connectedCallback()
    const form = this.querySelector<HTMLFormElement>(".searchbox-input")
    this._input = form?.querySelector<HTMLInputElement>("input") ?? null
    this._clearBtn = this.querySelector<HTMLButtonElement>(".appnav-search-clear")
    this._q = this._input?.value ?? ""
    form?.addEventListener("submit", this._onSubmit)
    this._input?.addEventListener("input", this._onInput)
    this._input?.addEventListener("focus", this._onStaticFocus)
    this._input?.addEventListener("keydown", this._onKeyDown)
    this._clearBtn?.addEventListener("click", this._clear)
    document.addEventListener("mousedown", this._onDocPointer)
    window.addEventListener("popstate", this._onPopState)
    window.addEventListener("resize", this._onResize)
    window.addEventListener("scroll", this._onResize, { passive: true })
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener("mousedown", this._onDocPointer)
    window.removeEventListener("popstate", this._onPopState)
    window.removeEventListener("resize", this._onResize)
    window.removeEventListener("scroll", this._onResize)
    this._releaseBody()
    this._resetSuggest()
  }

  private _sizeDropdown(): void {
    if (!this._showDropdown || this._fullscreen) {
      return
    }
    const dropdown = this.querySelector<HTMLElement>(".searchbox-dropdown")
    const wrap = this.querySelector<HTMLElement>(".searchbox")
    if (!dropdown || !wrap) {
      return
    }
    const margin = 16
    const gap = 6
    const available = window.innerHeight - wrap.getBoundingClientRect().bottom - gap - margin
    dropdown.style.maxHeight = `${Math.max(160, Math.min(480, available))}px`
  }

  private get _isEmpty(): boolean {
    return this._q.trim().length === 0
  }

  private get _rows(): { rows: Row[]; selectable: Row[] } {
    const rows: Row[] = []
    const selectable: Row[] = []
    const push = (row: Row, isSelectable = true) => {
      rows.push(row)
      if (isSelectable && !("header" in row)) {
        selectable.push(row)
      }
    }

    if (this._isEmpty) {
      if (QUICK_FILTERS.length) {
        rows.push({ header: true, section: "quick" })
        for (const qf of QUICK_FILTERS) {
          push({ kind: "quick-filter", value: qf })
        }
      }
      return { rows, selectable }
    }

    const s = this._suggestions
    if (!s) {
      return { rows, selectable }
    }

    if (s.categories?.length) {
      rows.push({ header: true, section: "categories" })
      for (const value of s.categories) {
        push({ kind: "category", value })
      }
    }
    if (s.devices?.length) {
      rows.push({ header: true, section: "devices" })
      for (const value of s.devices) {
        push({ kind: "device", value })
      }
      if (s.deviceMore) {
        push({ kind: "device-more", value: { count: s.deviceMore, term: this._q.trim() } })
      }
    }
    if (s.manufacturers?.length) {
      rows.push({ header: true, section: "manufacturers" })
      for (const value of s.manufacturers) {
        push({ kind: "manufacturer", value })
      }
    }
    return { rows, selectable }
  }

  private get _showDropdown(): boolean {
    const { selectable } = this._rows
    return this._open && selectable.length > 0
  }

  private _goBrowse(params: Record<string, string>): void {
    const qs = new URLSearchParams(params).toString()
    navigate(`/browse${qs ? "?" + qs : ""}`)
  }

  private _goBrowseFilters(filters: QuickFilter["filters"]): void {
    const p = new URLSearchParams()
    for (const v of filters.category ?? []) {
      p.append("category", v)
    }
    for (const v of filters.manufacturer ?? []) {
      p.append("manufacturer", v)
    }
    if (filters.localOnly) {
      p.set("local", "1")
    }
    const qs = p.toString()
    navigate(`/browse${qs ? "?" + qs : ""}`)
  }

  private _select(row: Row): void {
    if ("header" in row) {
      return
    }
    this._open = false
    this._closeFullscreen()
    this._q = ""
    this._resetSuggest()
    switch (row.kind) {
      case "category":
        this._goBrowse({ category: row.value.id })
        break
      case "device":
        navigate(`/device/${row.value.id}`)
        break
      case "device-more":
        this._goBrowse({ q: row.value.term })
        break
      case "manufacturer":
        this._goBrowse({ manufacturer: row.value })
        break
      case "quick-filter":
        this._goBrowseFilters(row.value.filters)
        break
    }
  }

  private _onSubmit = (event: Event): void => {
    event.preventDefault()
    const { selectable } = this._rows
    if (this._activeIdx >= 0 && this._activeIdx < selectable.length) {
      this._select(selectable[this._activeIdx])
      return
    }
    const term = this._q.trim()
    if (!term) {
      return
    }
    this._open = false
    this._closeFullscreen()
    this._q = ""
    this._resetSuggest()
    this._goBrowse({ q: term })
  }

  private _onKeyDown = (event: KeyboardEvent): void => {
    const { selectable } = this._rows
    if (event.key === "ArrowDown") {
      event.preventDefault()
      this._open = true
      this._activeIdx = Math.min(selectable.length - 1, this._activeIdx + 1)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      this._activeIdx = Math.max(-1, this._activeIdx - 1)
    } else if (event.key === "Escape") {
      this._open = false
      this._closeFullscreen()
    }
  }

  private _onInput = (event: Event): void => {
    this._q = (event.target as HTMLInputElement).value
    this._open = true
    this._activeIdx = -1
    this._fsScrolled = false
    this._scheduleSuggest()
  }

  private _scheduleSuggest(): void {
    clearTimeout(this._suggestTimer)
    if (this._isEmpty) {
      this._suggestAbort?.abort()
      this._suggestions = null
      return
    }
    this._suggestTimer = setTimeout(() => void this._runSuggest(), 220)
  }

  private async _runSuggest(): Promise<void> {
    const q = this._q
    this._suggestAbort?.abort()
    const controller = new AbortController()
    this._suggestAbort = controller
    const seq = ++this._suggestSeq
    try {
      const result = await fetchSuggestions(q, controller.signal)
      if (seq === this._suggestSeq) {
        this._suggestions = result
      }
    } catch {
      if (seq === this._suggestSeq) {
        this._suggestions = null
      }
    }
  }

  private _resetSuggest(): void {
    clearTimeout(this._suggestTimer)
    this._suggestAbort?.abort()
    this._suggestions = null
  }

  private _onStaticFocus = (): void => {
    this._onFocus(false)
  }

  private _onFocus(fromFs: boolean): void {
    this._open = true
    if (!fromFs) {
      this._openFullscreen()
    }
  }

  private _matchesFs(): boolean {
    return window.matchMedia(FS_QUERY).matches
  }

  private _openFullscreen(): void {
    if (this._fullscreen || !this._matchesFs()) {
      return
    }
    this._fullscreen = true
    document.body.classList.add("search-fullscreen-open")
    try {
      window.history.pushState({ searchFs: true }, "")
    } catch (e) {}
    this.updateComplete.then(() => {
      this.querySelector<HTMLInputElement>(".searchbox-fs input")?.focus()
    })
  }

  private _closeFullscreen(opts: { fromPopState?: boolean } = {}): void {
    if (!this._fullscreen) {
      return
    }
    this._fullscreen = false
    this._open = false
    this._releaseBody()
    if (!opts.fromPopState) {
      try {
        window.history.back()
      } catch (e) {}
    }
  }

  private _releaseBody(): void {
    document.body.classList.remove("search-fullscreen-open")
  }

  private _clear = (): void => {
    this._q = ""
    this._resetSuggest()
    this._open = false
    if (this._input) {
      this._input.value = ""
      this._input.focus()
    }
  }

  // The fullscreen overlay has its own (dynamic) input, so we render that one with lit.
  private _renderFsForm() {
    return html`
      <form
        class="searchbox-input"
        role="search"
        @submit=${this._onSubmit}
        @click=${(e: MouseEvent) => {
          if (e.target === e.currentTarget) {
            ;(e.currentTarget as HTMLElement).querySelector("input")?.focus()
          }
        }}
      >
        ${unsafeHTML(icon("search", 18))}
        <input
          type="search"
          .value=${this._q}
          placeholder=${this.placeholder}
          aria-label="Search devices"
          aria-autocomplete="list"
          aria-expanded=${this._showDropdown}
          @input=${this._onInput}
          @focus=${() => this._onFocus(true)}
          @keydown=${this._onKeyDown}
        />
        ${this._q
          ? html`<button
              type="button"
              class="searchbox-fs-clear"
              aria-label="Clear search"
              @click=${this._clear}
            >
              ${unsafeHTML(icon("x", 18))}
            </button>`
          : nothing}
      </form>
    `
  }

  private _renderRows() {
    const { rows } = this._rows
    const term = this._q.trim()
    let selIdx = -1
    return rows.map((row) => {
      if ("header" in row) {
        return html`<div class="searchbox-section">${SECTION_LABEL[row.section]}</div>`
      }
      selIdx += 1
      const localSel = selIdx
      const active = localSel === this._activeIdx
      return html`
        <button
          type="button"
          class=${"searchbox-row" + (active ? " active" : "")}
          role="option"
          aria-selected=${active}
          @mouseenter=${() => (this._activeIdx = localSel)}
          @mousedown=${(e: MouseEvent) => {
            e.preventDefault()
            this._select(row)
          }}
        >
          ${this._renderRowContent(row, term)}
        </button>
      `
    })
  }

  private _renderRowContent(row: Exclude<Row, { header: true }>, term: string) {
    switch (row.kind) {
      case "category":
        return html`${unsafeHTML(categoryGlyph(row.value.id, 18))}
          <span class="searchbox-row-main">${this._highlight(row.value.label, term)}</span>
          <span class="searchbox-row-meta">Category</span>`
      case "device":
        return html`${unsafeHTML(categoryGlyph(row.value.category, 18))}
          <span class="searchbox-row-main">${this._highlight(row.value.name, term)}</span>
          <span class="searchbox-row-meta">${row.value.manufacturer}</span>`
      case "device-more":
        return html`${unsafeHTML(icon("arrow", 16))}
          <span class="searchbox-row-main searchbox-more-text"
            >See all ${row.value.count} results for “${row.value.term}”</span
          >`
      case "manufacturer":
        return html`${unsafeHTML(icon("users", 16))}
          <span class="searchbox-row-main">${this._highlight(row.value, term)}</span>
          <span class="searchbox-row-meta">Manufacturer</span>`
      case "quick-filter":
        return html`${unsafeHTML(categoryGlyph(row.value.icon, 18))}
          <span class="searchbox-row-main">${row.value.title}</span>`
    }
  }

  private _highlight(text: string, term: string) {
    if (!term) {
      return text
    }
    const i = text.toLowerCase().indexOf(term.toLowerCase())
    if (i < 0) {
      return text
    }
    return html`${text.slice(0, i)}<mark>${text.slice(i, i + term.length)}</mark>${text.slice(
      i + term.length,
    )}`
  }

  // Keep the server-rendered field in sync with state we change programmatically (clear,
  // post-navigation reset) without disturbing the caret while the user is typing into it.
  protected updated(): void {
    if (this._input) {
      if (this._input !== document.activeElement && this._input.value !== this._q) {
        this._input.value = this._q
      }
      this._input.setAttribute("aria-expanded", String(this._showDropdown))
    }
    if (this._clearBtn) {
      this._clearBtn.hidden = this._isEmpty
    }
    this._sizeDropdown()
  }

  render() {
    return html`
      ${this._showDropdown && !this._fullscreen
        ? html`<div class="searchbox-dropdown" role="listbox">${this._renderRows()}</div>`
        : nothing}
      ${this._fullscreen
        ? html`
            <div class="searchbox-fs">
              <div class="searchbox-fs-bg" aria-hidden="true"></div>
              <button
                type="button"
                class="searchbox-fs-back"
                aria-label="Close search"
                @mousedown=${(e: MouseEvent) => {
                  e.preventDefault()
                  this._closeFullscreen()
                }}
              >
                ${unsafeHTML(icon("arrowL", 20))}
              </button>
              ${this._renderFsForm()}
              ${this._showDropdown
                ? html`<div
                    class=${"searchbox-dropdown" + (this._fsScrolled ? " is-scrolled" : "")}
                    role="listbox"
                    @scroll=${(e: Event) => {
                      this._fsScrolled = (e.currentTarget as HTMLElement).scrollTop > 0
                    }}
                  >
                    ${this._renderRows()}
                  </div>`
                : nothing}
            </div>
          `
        : nothing}
    `
  }
}

defineElementOnce("device-search", DeviceSearch)

declare global {
  interface HTMLElementTagNameMap {
    "device-search": DeviceSearch
  }
}
