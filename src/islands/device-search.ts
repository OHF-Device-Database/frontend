import { navigate } from "astro:transitions/client";
import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { Ref } from "lit/directives/ref.js";

import { getDevices } from "../io/device.js";
import { m } from "../paraglide/messages.js";
import { localizeHref } from "../paraglide/runtime.js";
import { browseFiltersToSearchParams } from "../types/browse/index.js";
import {
	DeviceCategoryTopLevelId,
	topLevelCategoryResolver,
} from "../types/category/index.js";
import { devicePolyMap } from "../types/device/index.js";
import { guard } from "../types/guard.js";
import { QUICK_FILTERS, QuickFilterId } from "../types/quick-filter.js";
import { Unknown } from "../types/unknown.js";
import { defineElementOnce } from "../utilities/define-element.js";
import { flatten } from "../utilities/flatten.js";
import { isAbortError } from "../utilities/is-abort-error.js";
import {
	device,
	generic,
	quickFilter,
	render,
} from "../utilities/presentation/index.js";
import { PresentationRenderPresetRoleIcon } from "../utilities/presentation/preset.js";
import type { IoDimensionCategory } from "../io/dimension.js";
import type { DevicePoly } from "../types/device/index.js";

type SectionCategory = {
	kind: "category";
	items: { id: DeviceCategoryTopLevelId; count: number }[];
};
type SectionDevice = {
	kind: "device";
	items?: DevicePoly[] | undefined;
	total?: number | undefined;
	stale: boolean;
};
type SectionManufacturer = {
	kind: "manufacturer";
	items: {
		name: string;
		count: number;
	}[];
};
type SectionQuickFilter = {
	kind: "quick-filter";
	items: QuickFilterId[];
};
type Section =
	SectionCategory | SectionDevice | SectionManufacturer | SectionQuickFilter;

const limits = {
	category: 3,
	device: 3,
	manufacturer: 2,
} as const;

export class DeviceSearch extends LitElement {
	@property() size: "header" | "hero" = "header";
	@property() placeholder = "Search";

	@property({
		attribute: "dimensions",
		type: Object,
	})
	dimensions: {
		manufacturers: { name: string; count: number }[];
		categories: Record<string, IoDimensionCategory>;
	} | null = null;

	@state() private _term = "";

	@state() private _fetchedDevices: {
		devices: DevicePoly[];
		total: number;
	} | null = null;
	@state() private _fetchedDevicesStale: boolean = true;

	private _fetchTimer?: ReturnType<typeof setTimeout>;
	private _fetchAbort?: AbortController;

	// server-rendered elements that are enhanced
	private _form: HTMLFormElement | null = null;
	private _input: HTMLInputElement | null = null;
	private _clearButton: HTMLButtonElement | null = null;
	private _popover: Ref<HTMLInputElement> = createRef();

	// opt-out of shadow dom to be able to reference global css classes
	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();

		const form = this.querySelector<HTMLFormElement>(".searchbox-input");
		this._form = form;

		this._input = form?.querySelector<HTMLInputElement>("input") ?? null;

		const clearButton =
			form?.querySelector<HTMLButtonElement>(".searchbox-button-clear") ?? null;
		if (clearButton !== null) {
			this._clearButton = clearButton;
			this._clearButton.hidden = false;
		}

		this._term = this._input?.value ?? "";

		this._input?.addEventListener("input", this._onInputInput);
		this._input?.addEventListener("focus", this._onInputFocus);
		this._input?.addEventListener("blur", this._onInputBlur);
		this._input?.addEventListener("keydown", this._onInputKeyDown);

		this._clearButton?.addEventListener("click", this._onClearButtonClick);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this._input?.removeEventListener("input", this._onInputInput);
		this._input?.removeEventListener("focus", this._onInputFocus);
		this._input?.removeEventListener("blur", this._onInputBlur);
		this._input?.removeEventListener("keydown", this._onInputKeyDown);

		this._clearButton?.removeEventListener("click", this._onClearButtonClick);

		this._resetFetched();
	}

	private get _isEmpty(): boolean {
		return this._term.trim().length === 0;
	}

	private _urlCategory(id: DeviceCategoryTopLevelId): string {
		const params = browseFiltersToSearchParams({
			category: new Set([id]),
			categoryMode: "include",
			localOnly: false,
			manufacturer: new Set(),
			manufacturerMode: "include",
		});

		const qs = params.toString();
		return localizeHref(`/browse${qs ? "?" + qs : ""}`);
	}

	private _urlDevice(id: string): string {
		return localizeHref(`/devices/${id}`);
	}

	private _urlTerm(term: string): string {
		const params = browseFiltersToSearchParams({
			category: new Set(),
			categoryMode: "include",
			localOnly: false,
			manufacturer: new Set(),
			manufacturerMode: "include",
			term,
		});

		const qs = params.toString();
		return localizeHref(`/browse${qs ? "?" + qs : ""}`);
	}

	private _urlManufacturer(manufacturer: string): string {
		const params = browseFiltersToSearchParams({
			category: new Set(),
			categoryMode: "include",
			localOnly: false,
			manufacturer: new Set([manufacturer]),
			manufacturerMode: "include",
		});

		const qs = params.toString();
		return localizeHref(`/browse${qs ? "?" + qs : ""}`);
	}

	private _urlQuickFilter(id: QuickFilterId): string {
		const { filters } = QUICK_FILTERS[id];
		const params = browseFiltersToSearchParams({
			category: new Set(filters.category),
			categoryMode: "include",
			localOnly:
				"connectivity" in filters && filters.connectivity === "offline",
			manufacturer: new Set(),
			manufacturerMode: "include",
		});

		const qs = params.toString();
		return localizeHref(`/browse${qs ? "?" + qs : ""}`);
	}

	private _onInputInput = (event: InputEvent) => {
		this._term = (event.target as HTMLInputElement).value;
		this._scheduleFetchDevices();
	};

	private _onInputFocus = () => {
		this._popover?.value?.showPopover(
			this._form !== null
				? // width of popover is set to that of source element and form
					// is wider than input field
					{ source: this._form }
				: undefined,
		);
	};

	private _onInputBlur = () => {
		this._closePopover();
	};

	private _onPopoverMouseDown = (event: MouseEvent) => {
		event.preventDefault();
	};

	private _closePopover(): void {
		const popover = this._popover?.value;
		popover?.hidePopover();
		for (const button of popover?.getElementsByTagName("button") ?? []) {
			button.setAttribute("aria-selected", "false");
		}
		this._input?.removeAttribute("aria-activedescendant");
	}

	private _onInputKeyDown = (event: KeyboardEvent) => {
		const popover = this._popover.value;
		if (typeof popover === "undefined") {
			return;
		}

		const rows = [...popover.getElementsByTagName("button")];
		if (typeof rows === "undefined") {
			return;
		}

		const active = popover.querySelector<HTMLButtonElement>(
			'[aria-selected="true"]',
		);
		const activeIdx = active !== null ? rows.indexOf(active) : null;

		switch (event.key) {
			case "Tab":
			case "ArrowDown": {
				active?.removeAttribute("aria-selected");

				const next =
					rows[
						activeIdx !== null ? Math.min(activeIdx + 1, rows.length - 1) : 0
					];

				// allow escaping focus of popover when navigating past last row
				if (event.key === "Tab" && next !== active) {
					event.preventDefault();
				}

				if (typeof next !== "undefined") {
					next.ariaSelected = "true";
					next.scrollIntoView({ block: "nearest" });
					this._input?.setAttribute("aria-activedescendant", next.id);
				}

				break;
			}
			case "ArrowUp": {
				// otherwise cursor jumps to start of input
				event.preventDefault();

				active?.removeAttribute("aria-selected");

				const next =
					rows[
						activeIdx !== null ? Math.max(activeIdx - 1, 0) : rows.length - 1
					];
				if (typeof next !== "undefined") {
					next.ariaSelected = "true";
					next.scrollIntoView({ block: "nearest" });
					this._input?.setAttribute("aria-activedescendant", next.id);
				}

				break;
			}
			case "Enter": {
				if (active !== null) {
					event.preventDefault();
				}

				active?.click();

				break;
			}
			case "Escape": {
				popover.hidePopover();
				break;
			}
		}
	};

	private _onClearButtonClick = () => {
		if (this._input !== null) {
			this._input.value = "";
			this._term = "";
			this._scheduleFetchDevices();
		}
	};

	private _scheduleFetchDevices(): void {
		clearTimeout(this._fetchTimer);
		if (this._isEmpty) {
			this._fetchAbort?.abort();
			return;
		}
		this._fetchedDevicesStale = true;
		this._fetchTimer = setTimeout(() => void this._fetchDevices(), 220);
	}

	private async _fetchDevices() {
		const term = this._term.trim();
		this._fetchAbort?.abort();
		const controller = new AbortController();
		this._fetchAbort = controller;

		try {
			const { devices, total } = await getDevices({ term }, controller.signal);
			this._fetchedDevices = {
				devices: devices.map(devicePolyMap),
				total,
			};
			this._fetchedDevicesStale = false;
		} catch (e) {
			if (!isAbortError(e)) {
				this._fetchedDevices = null;
			}

			this._fetchedDevicesStale = true;
		}
	}

	private _resetFetched(): void {
		clearTimeout(this._fetchTimer);
		this._fetchAbort?.abort();
		this._fetchedDevices = null;
	}

	private static _sectionQuickFilter(): SectionQuickFilter {
		const is = guard(QuickFilterId);

		return {
			kind: "quick-filter",
			items: Object.keys(QUICK_FILTERS).flatMap((key) =>
				is(key) ? [key] : [],
			),
		};
	}

	private _sectionCategory(term: string): SectionCategory {
		const is = guard(DeviceCategoryTopLevelId);

		return {
			kind: "category",
			items:
				typeof this.dimensions?.categories !== "undefined"
					? Object.entries(this.dimensions?.categories)
							?.flatMap(([id, category]) => {
								if (!is(id)) {
									return [];
								}
								const { label } = device.category(id);
								if (
									!label.toLocaleLowerCase().includes(term.toLocaleLowerCase())
								) {
									return [];
								}

								return [{ id, count: category.count }];
							})
							.toSorted((a, b) => b.count - a.count)
					: [],
		};
	}

	private _sectionDevice(): SectionDevice {
		return {
			kind: "device",
			items: this._fetchedDevices?.devices,
			total: this._fetchedDevices?.total,
			stale: this._fetchedDevicesStale,
		};
	}

	private _sectionManufacturer(term: string): SectionManufacturer {
		return {
			kind: "manufacturer",
			items:
				this.dimensions?.manufacturers.filter(({ name }) =>
					name.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
				) ?? [],
		};
	}

	private get _sections() {
		if (this._isEmpty) {
			return [
				DeviceSearch._sectionQuickFilter(),
				this._sectionCategory(""),
			] as const;
		}

		return [
			this._sectionDevice(),
			this._sectionManufacturer(this._term),
			this._sectionCategory(this._term),
		] as const;
	}

	private _renderSection(section: Section) {
		if (section.items?.length === 0) {
			return nothing;
		}

		let rendered;
		switch (section.kind) {
			case "quick-filter":
				rendered = html`<div class="searchbox-popover-section-header">
						<div class="searchbox-popover-section-label">
							${m.search_popover_section_quickfilter()}
						</div>
					</div>
					<div class="searchbox-popover-section-rows">
						${section.items.map((f) => {
							const filter = quickFilter(f);
							return html`<button
								id=${`quick-filter-${f}`}
								class="searchbox-popover-section-row"
								@click=${() => void navigate(this._urlQuickFilter(f))}
							>
								${unsafeHTML(render(filter, PresentationRenderPresetRoleIcon.withSize(16)))}

								<div class="searchbox-popover-section-row-main">
									<div>${filter.label}</div>
								</div>
							</button>`;
						})}
					</div>`;
				break;
			case "category":
				rendered = html`<div class="searchbox-popover-section-header">
						<div class="searchbox-popover-section-label">
							${m.search_popover_section_category()}
						</div>
					</div>
					<div class="searchbox-popover-section-rows">
						${section.items.slice(0, limits.category).map((c) => {
							const category = device.category(c.id);
							return html`<button
								class="searchbox-popover-section-row"
								id=${`category-${c.id}`}
								@click=${() => void navigate(this._urlCategory(c.id))}
							>
								${unsafeHTML(render(category, PresentationRenderPresetRoleIcon.withSize(16)))}

								<div class="searchbox-popover-section-row-main">
									<div>
										${DeviceSearch._highlight(category.label, this._term)}
									</div>
								</div>
								<span class="searchbox-popover-section-count">${c.count}</span>
							</button>`;
						})}
					</div>`;
				break;
			case "manufacturer":
				rendered = html`<div class="searchbox-popover-section-header">
						<div class="searchbox-popover-section-label">
							${m.search_popover_section_manufacturer()}
						</div>
					</div>
					<div class="searchbox-popover-section-rows">
						${section.items.slice(0, limits.manufacturer).map(
							(m) =>
								html`<button
									class="searchbox-popover-section-row"
									id=${`manufacturer-${m.name}`}
									@click=${() => void navigate(this._urlManufacturer(m.name))}
								>
									${unsafeHTML(render(generic("users"), PresentationRenderPresetRoleIcon.withSize(16)))}
									<div class="searchbox-popover-section-row-main">
										<div>${DeviceSearch._highlight(m.name, this._term)}</div>
									</div>
									<span class="searchbox-popover-section-count"
										>${m.count}</span
									>
								</button>`,
						)}
					</div>`;
				break;
			case "device": {
				const resolveTopLevelCategory =
					typeof this.dimensions?.categories !== "undefined"
						? topLevelCategoryResolver(this.dimensions?.categories)
						: (): Unknown => Unknown;

				rendered = html`<div class="searchbox-popover-section-header">
						<div class="searchbox-popover-section-label">
							${m.search_popover_section_device()}
						</div>
						${typeof section.items === "undefined" || section.stale ? html`<span class="searchbox-loading-spinner"></span>` : nothing}
					</div>
					${
						typeof section.items !== "undefined"
							? html`<div class="searchbox-popover-section-rows">
									${section.items.slice(0, limits.device).map((d) => {
										const first = d.categories?.at(0);

										const category = device.category(
											typeof first !== "undefined"
												? resolveTopLevelCategory(first)
												: Unknown,
										);
										return html`<button
											class=${"searchbox-popover-section-row" + (section.stale ? " searchbox-popover-section-row-stale" : "")}
											id=${`device-${d.id}`}
											@click=${() => void navigate(this._urlDevice(d.id))}
										>
											${unsafeHTML(render(category, PresentationRenderPresetRoleIcon.withSize(16)))}

											<div class="searchbox-popover-section-row-main">
												<span class="searchbox-popover-section-row-secondary"
													>${DeviceSearch._highlight(d.manufacturer, this._term)}</span
												>
												<span>
													${DeviceSearch._highlight(device.name(d), this._term)}
												</span>
											</div>
											<span class="searchbox-popover-section-count"
												>${d.count}</span
											>
										</button>`;
									})}
									${
										typeof section.total !== "undefined" &&
										section.total > limits.device
											? html`<button
													class="searchbox-popover-section-row"
													id=${`more-device`}
													@click=${() => void navigate(this._urlTerm(this._term))}
												>
													${unsafeHTML(render(generic("arrow"), PresentationRenderPresetRoleIcon.withSize(16)))}

													<span class="searchbox-more-text"
														>${unsafeHTML(m.search_popover_browse_more_devices({ count: flatten(html`<span class=${section.stale ? "redacted" : ""}>${section.total - limits.device}</span>`) }))}</span
													>
												</button>`
											: nothing
									}
								</div>`
							: nothing
					}`;
				break;
			}
		}

		return html`<div class="searchbox-popover-section">${rendered}</div>`;
	}

	private static _highlight(text: string, term: string) {
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

	protected override render() {
		const sections = this._sections;
		return html`<div
			class="searchbox-popover"
			popover="manual"
			role="listbox"
			@mousedown=${this._onPopoverMouseDown}
			${ref(this._popover)}
		>
			<div class="searchbox-popover-content">
				${
					sections.every(
						(s) => typeof s.items !== "undefined" && s.items.length === 0,
					)
						? html`<p>${m.search_popover_no_matches()}</p>`
						: this._sections.map((s) => this._renderSection(s))
				}
			</div>
		</div>`;
	}
}

defineElementOnce("device-search", DeviceSearch);

declare global {
	interface HTMLElementTagNameMap {
		"device-search": DeviceSearch;
	}
}
