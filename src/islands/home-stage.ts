import { defineElementOnce } from "../utilities/define-element.js";
import {
	HOME_CATEGORY_DRAWINGS,
	HOME_DRAWINGS,
	HOME_OPENING,
	HOME_PALETTES,
	homeArtId,
	homeSlotRatio,
	homeSlotSpec,
} from "../utilities/home-art.js";
import {
	clamp01,
	detent,
	ease,
	footerStep,
	mod,
	rowOpacity,
	rowParting,
	smooth,
	spinIn,
	spinStagger,
	stepToward,
	switchSlack,
} from "../utilities/home-motion.js";
import type { HomeCardSpec, HomePalette } from "../utilities/home-art.js";

/*
 * The landing page's motion, after the design handoff's home prototype.
 *
 * Reels of cards spin in behind the hero, then drift and follow the scroll.
 * Below the hero the category list holds the screen and scrolls through a
 * reading line at mid screen. While it does, the page turns blue and the
 * cards become blueprints.
 *
 * Two things differ from the prototype on purpose. A card keeps its slot when
 * the category changes: only its drawing is swapped. And while the page is
 * blue the cards move with the scroll and nothing else. Clicking a card does
 * nothing.
 *
 * Leaving for another page plays the prototype's exit: the page clears and
 * the reels spin up again while the next page loads.
 *
 * With reduced motion there are no reels at all. Even standing still they
 * would change their drawings as the list scrolls.
 */

/** seconds the first reel spins for */
const SPIN = 2.4;
const STAGGER = 0.34;
/** a reel starts at this many screen heights a second */
const SPEED = 5.2;
/** px a second, once landed */
const DRIFT = 16;
/** card width over the reel's width */
const SIZE = 1.15;
/** how many of the cards that come round are filled */
const MIX = 0.45;
/** where each reel's first card lands, in reel widths */
const LAND = [0.366, -0.45, 0.68, -0.623];
/** how strongly each reel follows the scroll */
const PARALLAX = [0.42, 0.24, 0.3, 0.48];
/** px of scroll for each category */
const ROW_STEP = 64;
const SWITCH_SECONDS = 0.55;
/** seconds the reels spin out for before the next page shows */
const EXIT_SECONDS = 1.45;
const FOOTER_BANDS = 6;
const FOOTER_BAND_HEIGHT = 18;

const SVG = "http://www.w3.org/2000/svg";

const drawings: Record<string, readonly string[] | undefined> =
	HOME_CATEGORY_DRAWINGS;

type Card = {
	el: HTMLDivElement;
	face: HTMLDivElement;
	reel: Reel;
	slot: number;
	lap: number;
	base: number;
	h: number;
	y: number;
	cycle: number | undefined;
	/** the card's own content, shown when no category is in focus */
	baseSpec: HomeCardSpec;
	spec: HomeCardSpec;
};

type Reel = {
	el: HTMLElement;
	i: number;
	blur: Element | null;
	blurQ: number;
	cards: Card[];
	off: boolean;
	w: number;
	cw: number;
	dx: number;
	L: number;
	n: number;
	T: number;
	pad: number;
	ord: number;
	start: number;
	A: number;
	D: number;
	dir: number;
	driftPos: number;
	driftLive: boolean;
	flingPos: number;
	flingV: number;
	hoverMul: number;
	hoverTarget: number;
	dragging: boolean;
	lastPalette: HomePalette | undefined;
	/** how far the reel has run since the page started to leave */
	outPos: number;
};

const pick = <T>(items: readonly T[]): T | undefined =>
	items[Math.floor(Math.random() * items.length)];

const sameSpec = (a: HomeCardSpec, b: HomeCardSpec): boolean =>
	a.kind === b.kind &&
	(a.kind === "dash" || (b.kind !== "dash" && a.drawing === b.drawing));

const artElement = (drawing: string): HTMLDivElement => {
	const art = document.createElement("div");
	art.className = "home-card-art";
	const svg = document.createElementNS(SVG, "svg");
	const use = document.createElementNS(SVG, "use");
	use.setAttribute("href", `#${homeArtId(drawing)}`);
	svg.append(use);
	art.append(svg);
	return art;
};

const render = (card: Card, spec: HomeCardSpec): void => {
	card.spec = spec;
	card.face.className = `home-card-face home-card-face--${spec.kind}`;
	if (spec.kind === "dash") {
		card.face.replaceChildren();
		return;
	}
	const children: HTMLElement[] = [artElement(spec.drawing)];
	if (spec.figure !== undefined) {
		const figure = document.createElement("span");
		figure.className = "home-card-figure";
		figure.textContent = spec.figure;
		children.push(figure);
	}
	card.face.replaceChildren(...children);
};

/** cross-fades a filled card's drawing to another one, in place */
const swapArt = (card: Card, spec: HomeCardSpec, delay: number): void => {
	card.spec = spec;
	if (spec.kind === "dash") {
		return;
	}
	for (const old of card.face.querySelectorAll(
		".home-card-art:not(.is-leaving)",
	)) {
		old.classList.add("is-leaving");
		const leaving = old.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 240,
			delay,
			easing: "cubic-bezier(.4,0,.2,1)",
			fill: "forwards",
		});
		leaving.onfinish = () => {
			old.remove();
		};
	}
	const art = artElement(spec.drawing);
	art.style.opacity = "0";
	card.face.append(art);
	art.animate([{ opacity: 0 }, { opacity: 1 }], {
		duration: 380,
		delay: delay + 70,
		easing: "cubic-bezier(.4,0,.2,1)",
		fill: "forwards",
	});
};

/** runs the page until the returned function is called */
const start = (host: HTMLElement): (() => void) => {
	const gallery = host.querySelector<HTMLElement>(".home-gallery");
	const stage = host.querySelector<HTMLElement>(".home-stage");
	const section = host.querySelector<HTMLElement>(".home-cats");
	const track = host.querySelector<HTMLElement>(".home-cats-track");
	const spacer = host.querySelector<HTMLElement>(".home-cats-spacer");
	const list = host.querySelector<HTMLElement>(".home-cats ul");
	const listReel = host.querySelector<HTMLElement>(".home-cats-reel");
	const heroSearch = host.querySelector<HTMLElement>(".home-search");
	const bottomShade = host.querySelector<HTMLElement>(".home-bottom-shade");
	const rows = [...host.querySelectorAll<HTMLElement>(".home-cat")];
	const firstRow = rows[0];
	if (
		gallery === null ||
		stage === null ||
		section === null ||
		track === null ||
		spacer === null ||
		list === null ||
		listReel === null ||
		heroSearch === null ||
		bottomShade === null ||
		firstRow === undefined
	) {
		return () => undefined;
	}

	const abort = new AbortController();
	const { signal } = abort;
	const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

	const header = document.querySelector<HTMLElement>(".appnav");
	const dock = document.querySelector<HTMLElement>("[data-appnav-search-dock]");
	const footer = document.querySelector<HTMLElement>(".appfoot");
	const steps = document.querySelector<HTMLElement>(".appfoot-steps");
	// counted from the footer up
	const bands = [
		...(steps?.querySelectorAll<HTMLElement>("i") ?? []),
	].reverse();
	const fading = [
		...host.querySelectorAll<HTMLElement>(
			".home-hero-top h1, .home-sub, .home-search, .home-browse",
		),
	];

	// the drawings, fetched once and shown by every card with `<use>`
	const sprite = host.querySelector<HTMLElement>(".home-sprite");
	const artUrl = host.getAttribute("art");
	if (!reduce && sprite !== null && artUrl !== null) {
		fetch(artUrl, { signal })
			.then((response) => (response.ok ? response.text() : ""))
			.then((svg) => {
				sprite.innerHTML = svg;
			})
			.catch(() => {
				// the cards stay empty frames in their colours
			});
	}

	let H = 0;
	let exiting = false;
	let exitAt = 0;
	let t0 = 0;
	let last = performance.now();
	let maxD = 0;
	let figure = 7;
	let lastScroll = window.scrollY;
	let snap = (value: number): number => value;

	/* ---------- cards ---------- */

	/** the category whose drawings the cards show */
	let focus: string | undefined;
	let focusIndex = 0;
	let focusMul = 1;

	const variant = (spec: HomeCardSpec): HomeCardSpec => {
		if (focus === undefined || spec.kind === "dash") {
			return spec;
		}
		const options = drawings[focus];
		const drawing = options?.[focusIndex++ % options.length];
		return drawing === undefined ? spec : { ...spec, drawing };
	};

	const paint = (card: Card, spec: HomeCardSpec): void => {
		card.baseSpec = spec;
		render(card, variant(spec));
	};

	const randomSpec = (reel: Reel): HomeCardSpec => {
		if (Math.random() > MIX) {
			return { kind: "dash" };
		}
		const kind =
			pick(HOME_PALETTES.filter((palette) => palette !== reel.lastPalette)) ??
			"sand";
		reel.lastPalette = kind;
		return {
			kind,
			drawing: pick(HOME_DRAWINGS) ?? "lighting",
			figure: Math.random() < 0.55 ? `FIG. ${figure++}.` : undefined,
		};
	};

	// none with reduced motion, where the gallery is not shown
	const reels: Reel[] = (
		reduce ? [] : [...stage.querySelectorAll<HTMLElement>(".home-reel")]
	)
		.slice(0, HOME_OPENING.length)
		.map((el, i) => ({
			el,
			i,
			blur: host.querySelector(`#home-blur-${i} feGaussianBlur`),
			blurQ: -1,
			cards: [],
			off: false,
			w: 0,
			cw: 0,
			dx: 0,
			L: 0,
			n: 0,
			T: 0,
			pad: 0,
			ord: i,
			start: 0,
			A: 0,
			D: 1,
			dir: 1,
			driftPos: 0,
			driftLive: false,
			flingPos: 0,
			flingV: 0,
			hoverMul: 1,
			hoverTarget: 1,
			dragging: false,
			lastPalette: undefined,
			outPos: 0,
		}));

	const makeCard = (reel: Reel, slot: number, lap: number): Card => {
		const el = document.createElement("div");
		el.className = "home-card";
		const face = document.createElement("div");
		el.append(face);
		const spec = homeSlotSpec(HOME_OPENING[reel.i]?.[slot] ?? [1]);
		const card: Card = {
			el,
			face,
			reel,
			slot,
			lap,
			base: 0,
			h: 0,
			y: 0,
			cycle: undefined,
			baseSpec: spec,
			spec,
		};
		paint(card, spec);
		return card;
	};

	const layout = (): void => {
		// the gallery fills the screen, and is not there with reduced motion
		H = reduce ? window.innerHeight : gallery.clientHeight;
		gallery.style.perspective = `${Math.round(Math.max(900, H * 1.7))}px`;
		const dpr = window.devicePixelRatio || 1;
		snap = (value) => Math.round(value * dpr) / dpr;

		const [first, second] = reels;
		if (first === undefined || second === undefined) {
			return;
		}
		const w0 = first.el.clientWidth;
		const gap = snap(
			Math.max(0, second.el.offsetLeft - first.el.offsetLeft - w0),
		);
		// exact track positions (offsetLeft is rounded), so every card edge
		// lands on a device pixel
		const style = getComputedStyle(stage);
		const columnGap = parseFloat(style.columnGap) || 0;
		const lefts: number[] = [];
		let x = parseFloat(style.paddingLeft) || 0;
		for (const width of style.gridTemplateColumns.split(" ").map(parseFloat)) {
			lefts.push(x);
			x += width + columnGap;
		}

		for (const reel of reels) {
			const w = parseFloat(getComputedStyle(reel.el).width) || 0;
			// hidden at this width
			reel.off = w === 0;
			if (reel.off) {
				continue;
			}
			const offsetLeft = reel.el.offsetLeft;
			const left = lefts.reduce(
				(best, candidate) =>
					Math.abs(candidate - offsetLeft) < Math.abs(best - offsetLeft)
						? candidate
						: best,
				lefts[0] ?? 0,
			);
			reel.dx = snap(left) - left;
			reel.cw = snap(left + w) - snap(left);

			let total = 0;
			const items = (HOME_OPENING[reel.i] ?? []).map((slot) => {
				const h = snap(homeSlotRatio(slot) * SIZE * w);
				const item = { h, base: total };
				total += h + gap;
				return item;
			});
			const L = total;
			const maxH = Math.max(...items.map((item) => item.h));
			const n = Math.max(1, Math.ceil((2.6 * H + 2 * maxH) / L));
			if (reel.L > 0) {
				const k = L / reel.L;
				reel.start *= k;
				reel.A *= k;
				reel.driftPos *= k;
				reel.flingPos *= k;
			}
			if (n !== reel.n) {
				reel.cards = [];
				for (let lap = 0; lap < n; lap++) {
					for (let slot = 0; slot < items.length; slot++) {
						reel.cards.push(makeCard(reel, slot, lap));
					}
				}
				reel.el.replaceChildren(...reel.cards.map((card) => card.el));
			}
			for (const card of reel.cards) {
				const item = items[card.slot];
				if (item === undefined) {
					continue;
				}
				card.h = item.h;
				card.base = item.base + card.lap * L;
				card.el.style.height = `${card.h}px`;
				card.el.style.width = `${reel.cw}px`;
			}
			reel.w = w;
			reel.L = L;
			reel.n = n;
			reel.T = n * L;
			reel.pad = (reel.T - H) / 2;
		}
	};

	const startIntro = (now: number, skip: boolean): void => {
		t0 = skip ? now - 1e6 : now;
		const visible = reels
			.filter((reel) => !reel.off)
			.sort((a, b) => a.el.offsetLeft - b.el.offsetLeft);
		const stagger = spinStagger(visible.length, STAGGER);
		visible.forEach((reel, order) => {
			reel.ord = order;
		});
		maxD = SPIN + stagger * (visible.length - 1);
		figure = 11;
		for (const reel of reels) {
			reel.D = SPIN + reel.ord * stagger;
			reel.A = (SPEED * H * reel.D) / 4;
			reel.dir = reel.ord % 2 === 1 ? -1 : 1;
			// the offset that puts the first card where the design has it
			const target = (LAND[reel.i] ?? 0) * reel.w + reel.pad;
			reel.driftPos = 0;
			reel.driftLive = false;
			reel.flingPos = 0;
			reel.flingV = 0;
			reel.start = target - reel.dir * (reel.A + DRIFT * reel.D);
		}
	};

	const liveCards = (): Card[] =>
		reels.flatMap((reel) => (reel.off ? [] : reel.cards));

	/** shows a category's drawings on the filled cards, each in its place */
	const applyFocus = (category: string | undefined): void => {
		if (category === focus) {
			return;
		}
		focus = category;
		focusIndex = 0;
		const filled = liveCards()
			.filter((card) => card.baseSpec.kind !== "dash")
			// a cascade from the top, quick enough to read as one gesture
			.sort((a, b) => a.y - b.y);
		for (const card of filled) {
			const next = variant(card.baseSpec);
			if (sameSpec(next, card.spec)) {
				continue;
			}
			const onScreen = card.y > -card.h && card.y < H;
			if (!onScreen) {
				render(card, next);
				continue;
			}
			swapArt(
				card,
				next,
				Math.min(90, card.reel.i * 15 + (Math.max(0, card.y) / H) * 50),
			);
		}
	};

	/* ---------- the category list as a reel ---------- */

	const items = rows.map((row) => row.closest("li") ?? row);
	const parting = items.map(() => 0);
	const band = document.createElement("li");
	const hoverBand = document.createElement("li");
	for (const element of [band, hoverBand]) {
		element.className = "home-cats-band";
		element.setAttribute("aria-hidden", "true");
		element.setAttribute("role", "presentation");
	}
	list.prepend(band, hoverBand);

	/** each row's centre within the list reel */
	let centres: number[] = [];
	let listPos = 0;
	let lineRow = -1;
	let bandBox: [number, number, number, number] | undefined;
	let hoverRow = -1;
	let hoverShown = -1;
	let hoverK = 0;
	let lineK = 1;

	const fitList = (): void => {
		section.classList.add("is-rolo");
		centres = items.map(
			(item) => list.offsetTop + item.offsetTop + item.offsetHeight / 2,
		);
		spacer.style.height = `${Math.round(
			(rows.length - 1) * ROW_STEP + window.innerHeight * 0.1,
		)}px`;
		// the first category starts on the reading line: pull the track up so
		// the heading lands where it would without the reel
		track.style.marginTop = "";
		const base = parseFloat(getComputedStyle(track).marginTop) || 0;
		track.style.marginTop = `${Math.round(
			base - (window.innerHeight / 2 - (centres[0] ?? 0)),
		)}px`;
	};

	const boxOf = (index: number): [number, number, number, number] => {
		const row = rows[index];
		const item = items[index];
		if (row === undefined || item === undefined) {
			return [0, 0, 0, 0];
		}
		const name = row.querySelector<HTMLElement>(".home-cat-name") ?? row;
		return [
			item.offsetLeft + row.offsetLeft + name.offsetLeft - 16,
			item.offsetTop + (parting[index] ?? 0) - 4,
			name.offsetWidth + 32,
			item.offsetHeight + 8,
		];
	};

	const moveList = (dt: number, sectionProgress: number): void => {
		const count = rows.length;
		const viewport = window.innerHeight;
		const hold = Math.max(1, spacer.offsetHeight);
		const run = (count - 1) * ROW_STEP;
		const trackTop = track.getBoundingClientRect().top;
		const held = -trackTop;
		const target = detent(clamp01(held / run) * (count - 1));
		listPos += (target - listPos) * (reduce ? 1 : ease(11, dt));

		const below = Math.min(count - 2, Math.floor(listPos));
		const from = centres[below] ?? 0;
		const to = centres[below + 1] ?? from;
		const centre = from + (to - from) * (listPos - below);
		listReel.style.transform = `translate3d(0,${(viewport / 2 - centre).toFixed(2)}px,0)`;

		items.forEach((item, index) => {
			const distance = index - listPos;
			const offset = Number(rowParting(distance).toFixed(2));
			parting[index] = offset;
			item.style.transform = `translate3d(0,${offset}px,0)`;
			rows[index]?.style.setProperty(
				"--o",
				rowOpacity(distance, sectionProgress).toFixed(3),
			);
		});

		const onLine = Math.min(count - 1, Math.max(0, Math.round(listPos)));
		if (onLine !== lineRow) {
			rows[lineRow]?.classList.remove("is-focus", "is-tick");
			const row = rows[onLine];
			if (row !== undefined) {
				row.classList.add("is-focus");
				row.classList.remove("is-tick");
				// restarts the tick
				void row.offsetWidth;
				row.classList.add("is-tick");
			}
			lineRow = onLine;
		}

		// the band shows only while the list holds the screen
		const visible =
			clamp01((180 - trackTop) / 180) * (1 - clamp01((held - hold) / 140));
		const targetBox = boxOf(onLine);
		bandBox ??= targetBox;
		const k = reduce ? 1 : ease(14, dt);
		bandBox = bandBox.map(
			(value, index) => value + ((targetBox[index] ?? value) - value) * k,
		) as [number, number, number, number];
		// resting on another row gives it a band of its own, and the one on
		// the reading line steps back
		const away = hoverRow >= 0 && hoverRow !== onLine;
		const fade = reduce ? 1 : ease(9, dt);
		if (hoverRow >= 0 && hoverRow !== hoverShown) {
			hoverShown = hoverRow;
			hoverK = 0;
		}
		lineK += ((away ? 0 : 1) - lineK) * fade;
		hoverK += ((away && hoverShown === hoverRow ? 1 : 0) - hoverK) * fade;
		const [bx, by, bw, bh] = bandBox;
		band.style.cssText = `transform:translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0);width:${bw.toFixed(1)}px;height:${bh.toFixed(1)}px;opacity:${(visible * lineK).toFixed(3)}`;
		if (hoverShown >= 0) {
			const [hx, hy, hw, hh] = boxOf(hoverShown);
			hoverBand.style.cssText = `transform:translate3d(${hx}px,${hy}px,0);width:${hw}px;height:${hh}px;opacity:${(visible * hoverK).toFixed(3)}`;
		}
	};

	/* resting on a category shows it: the row marks itself after a short
	   pause and the cards follow after a longer one, so sweeping across the
	   list does nothing */
	let hoverCategory: string | undefined;
	let markTimer = 0;
	let intentTimer = 0;
	let clearTimer = 0;

	const clearTimers = (): void => {
		window.clearTimeout(markTimer);
		window.clearTimeout(intentTimer);
		window.clearTimeout(clearTimer);
	};
	const mark = (active: HTMLElement | undefined): void => {
		for (const row of rows) {
			row.classList.toggle("is-active", row === active);
		}
	};
	const enter = (row: HTMLElement, markDelay: number, delay: number): void => {
		clearTimers();
		markTimer = window.setTimeout(() => {
			mark(row);
		}, markDelay);
		intentTimer = window.setTimeout(() => {
			hoverCategory = row.dataset["category"];
		}, delay);
	};
	const leave = (): void => {
		clearTimers();
		mark(undefined);
		clearTimer = window.setTimeout(() => {
			hoverCategory = undefined;
		}, 220);
	};
	rows.forEach((row, index) => {
		/** the window lost focus with the row still the active element */
		let kept = false;
		row.addEventListener(
			"pointerenter",
			(event) => {
				if (event.pointerType !== "mouse") {
					return;
				}
				hoverRow = index;
				enter(row, 60, focus === undefined ? 180 : 130);
			},
			{ signal },
		);
		row.addEventListener(
			"focus",
			() => {
				hoverRow = index;
				enter(row, 0, 120);
				const returning = kept;
				kept = false;
				// a row reached with the keyboard can sit outside the part of the
				// list that shows. bring it to the reading line, where scrolling
				// would put it. coming back to the window leaves the page alone
				if (returning || !row.matches(":focus-visible")) {
					return;
				}
				// a frame later, after the browser's own scroll into view
				requestAnimationFrame(() => {
					if (signal.aborted || document.activeElement !== row) {
						return;
					}
					window.scrollTo({
						top:
							window.scrollY +
							track.getBoundingClientRect().top +
							index * ROW_STEP,
						behavior: reduce ? "instant" : "smooth",
					});
				});
			},
			{ signal },
		);
		row.addEventListener(
			"blur",
			() => {
				kept = document.activeElement === row;
				if (hoverRow === index) {
					hoverRow = -1;
				}
			},
			{ signal },
		);
	});
	list.addEventListener(
		"pointerleave",
		(event) => {
			hoverRow = -1;
			if (event.pointerType === "mouse") {
				leave();
			}
		},
		{ signal },
	);
	list.addEventListener(
		"focusout",
		(event) => {
			if (
				!(event.relatedTarget instanceof Node) ||
				!list.contains(event.relatedTarget)
			) {
				leave();
			}
		},
		{ signal },
	);

	/* ---------- the section switch ---------- */

	let entered = false;
	let left = false;
	let switching = 0;
	let sectionMul = 1;
	let blue = false;
	/** what the cards should show, and since when */
	let wanted: string | undefined;
	let wantedAt = 0;

	const setBlue = (on: boolean): void => {
		if (on === blue) {
			return;
		}
		blue = on;
		host.classList.toggle("is-blue", on);
		if (on) {
			// a drag under way ends here, where it is
			for (const reel of reels) {
				reel.dragging = false;
				reel.el.classList.remove("is-dragging");
			}
		}
		// the header reads in white over the cobalt
		if (header !== null) {
			if (on) {
				header.dataset["theme"] = "dark";
			} else {
				header.removeAttribute("data-theme");
			}
		}
	};

	const switchSection = (progress: number): void => {
		const value = progress.toFixed(3);
		host.style.setProperty("--home-sp", value);
		steps?.style.setProperty("--home-sp", value);
		setBlue(progress > 0.55);
		gallery.classList.toggle("is-blueprint", progress > 0.5);
		// blue: the cards only move with the scroll
		sectionMul = 1 - progress;
	};

	let docked = false;
	const showDock = (on: boolean): void => {
		docked = on;
		if (dock !== null) {
			dock.classList.toggle("is-shown", on);
			dock.inert = !on;
			// the hero search has faded out under the header by then, so it
			// steps out of the tab order while the header's stands in for it
			heroSearch.inert = on;
		}
	};
	// the hero search and the one in the header stand for one search. what
	// was typed, and the focus, go with whichever is on screen
	const heroInput = heroSearch.querySelector("input");
	const dockInput = dock?.querySelector("input") ?? null;
	const setDock = (on: boolean): void => {
		const from = on ? heroInput : dockInput;
		const to = on ? dockInput : heroInput;
		if (from === null || to === null) {
			showDock(on);
			return;
		}
		const focused = document.activeElement === from;
		if (to.value !== from.value) {
			to.value = from.value;
			// the search reads its query from this event
			to.dispatchEvent(new InputEvent("input", { bubbles: true }));
		}
		showDock(on);
		if (focused) {
			to.focus({ preventScroll: true });
			to.setSelectionRange(from.selectionStart, from.selectionEnd);
		}
	};

	const scrollUI = (scrollY: number, dt: number, now: number): void => {
		const viewport = window.innerHeight;
		const searchTop = heroSearch.getBoundingClientRect().top;
		const headerBottom = header?.getBoundingClientRect().bottom ?? 64;
		// the shade at the bottom belongs to the first screen
		bottomShade.style.opacity = (
			1 - smooth(clamp01(scrollY / (H * 0.3)))
		).toFixed(3);

		// the hero scrolls with the page and only fades as it slides under
		// the header
		const line = headerBottom - 8;
		const fadeLength = Math.max(80, H * 0.16);
		for (const element of fading) {
			const top = element.getBoundingClientRect().top;
			element.style.setProperty(
				"--sf",
				smooth(clamp01((top - line) / fadeLength)).toFixed(3),
			);
		}

		// once the hero search is under the header, one appears in it. it
		// hides again only a little further back, so it does not flicker
		if (!docked && searchTop < line) {
			setDock(true);
		} else if (docked && searchTop > line + 24) {
			setDock(false);
		}

		const listProgress = smooth(clamp01((scrollY - H * 0.04) / (H * 0.42)));
		moveList(dt, listProgress);

		// crossing a line starts a timed change. scrolling back over it, with
		// some slack, plays it in reverse
		const trackRect = track.getBoundingClientRect();
		const footerTop =
			footer?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
		const enterLine = viewport * 0.3;
		const listTop = trackRect.top + viewport * 0.1;
		// the top of the page is never blue. on a short screen the list starts
		// close to its line there, and the slack shrinks to fit
		const atTop = scrollY <= 0;
		const slack = switchSlack(listTop + scrollY, enterLine);
		if (!entered && !atTop && listTop < enterLine) {
			entered = true;
		} else if (entered && (atTop || listTop > enterLine + slack)) {
			entered = false;
		}
		const leaving =
			trackRect.bottom < viewport * 0.55 || footerTop < viewport - 120;
		const back =
			trackRect.bottom > viewport * 0.55 + 160 && footerTop > viewport;
		if (!left && leaving) {
			left = true;
		} else if (left && back) {
			left = false;
		}
		const target = entered && !left ? 1 : 0;
		switching = reduce
			? target
			: stepToward(switching, target, dt, SWITCH_SECONDS);
		switchSection(smooth(switching));

		// the cards show the category you rest on, or while the page is blue
		// the one on the reading line once it has settled there
		const onLine = blue ? rows[lineRow]?.dataset["category"] : undefined;
		const next = hoverCategory ?? onLine;
		if (next !== wanted) {
			wanted = next;
			wantedAt = now;
		}
		const settle = hoverCategory === undefined && next !== undefined ? 120 : 0;
		if (wanted !== focus && now - wantedAt >= settle) {
			applyFocus(wanted);
		}

		// the footer steps open from the footer up as it comes into view
		if (footer !== null && bands.length > 0) {
			const progress = reduce
				? 1
				: clamp01((viewport - footerTop) / (viewport * 0.6));
			bands.forEach((element, index) => {
				element.style.height = `${footerStep(
					progress,
					index,
					FOOTER_BANDS,
					FOOTER_BAND_HEIGHT,
				).toFixed(1)}px`;
			});
		}
	};

	/* ---------- frame loop ---------- */

	let raf = 0;
	const frame = (now: number): void => {
		const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
		last = now;
		const t = (now - t0) / 1000;

		const scrollY = window.scrollY;
		const dy = scrollY - lastScroll;
		lastScroll = scrollY;
		scrollUI(scrollY, dt, now);

		// the camera starts receded and tilted and settles flat as the reels
		// slow. scrolling never tilts it
		// and recedes again when the page is left
		const exit = exiting ? (now - exitAt) / 1000 : 0;
		const k = Math.max(
			(1 - clamp01(t / (maxD * 0.95))) ** 3,
			exiting ? smooth(clamp01(exit / 1.2)) : 0,
		);
		stage.style.transform =
			k > 0.0005
				? `translate3d(0,0,${(-280 * k).toFixed(2)}px) rotateX(${(16 * k).toFixed(3)}deg) rotateZ(${(-2.2 * k).toFixed(3)}deg)`
				: "";

		// a category in focus brings every reel gently to rest
		focusMul += ((focus === undefined ? 1 : 0) - focusMul) * ease(3, dt);

		for (const reel of reels) {
			if (reel.off) {
				continue;
			}
			const landed = t >= reel.D;
			const spin = spinIn(t, reel.A, reel.D);
			if (!landed) {
				reel.driftPos = DRIFT * t;
			} else {
				if (!reel.driftLive) {
					reel.driftPos = DRIFT * reel.D;
					reel.driftLive = true;
				}
				reel.hoverMul += (reel.hoverTarget - reel.hoverMul) * ease(4, dt);
				reel.driftPos += DRIFT * reel.hoverMul * focusMul * sectionMul * dt;
			}
			// a fling slows to nothing as the page turns blue, and is spent
			// once it has
			const flingV = reel.flingV * sectionMul;
			if (!reel.dragging) {
				reel.flingPos += flingV * dt;
				reel.flingV *= Math.exp(-dt * 2.4);
				if (Math.abs(reel.flingV) < 0.5 || sectionMul < 0.001) {
					reel.flingV = 0;
				}
			}
			// the scroll pulls each reel along at its own rate
			reel.flingPos -= dy * (PARALLAX[reel.i] ?? 0);

			// leaving: each reel kicks off a beat after its neighbour and speeds
			// up like a slot machine
			let outV = 0;
			if (exiting) {
				const e = clamp01((exit - reel.ord * 0.06) / 1.1);
				outV = reel.dir * SPEED * H * e ** 3;
				reel.outPos += outV * dt;
			}

			const offset =
				reel.start +
				reel.dir * (spin.position + reel.driftPos) +
				reel.flingPos +
				reel.outPos;
			const speed =
				Math.abs(reel.dir * spin.velocity + flingV + outV) / (1.6 * H);
			// drum curvature, 1 over its radius
			const kappa = Math.min(1, speed) ** 0.7 / (0.72 * H);
			const fade =
				clamp01((t - reel.ord * 0.07) / 0.6) *
				(exiting ? 1 - smooth(clamp01((exit - 0.7) / 0.55)) : 1);

			const q = Math.round(Math.min(14, speed * 7) * 2) / 2;
			if (q !== reel.blurQ) {
				reel.blurQ = q;
				reel.blur?.setAttribute("stdDeviation", `0 ${q}`);
				reel.el.classList.toggle("is-blurred", q > 0);
			}

			for (const card of reel.cards) {
				const raw = card.base + offset;
				// a card that loops round out of view comes back as a new one
				const cycle = Math.floor(raw / reel.T);
				if (!landed) {
					card.cycle = undefined;
				} else if (card.cycle === undefined) {
					card.cycle = cycle;
				} else if (cycle !== card.cycle) {
					card.cycle = cycle;
					paint(card, randomSpec(reel));
				}

				const y = mod(raw, reel.T) - reel.pad;
				card.y = y;
				let ty = snap(y);
				let tz = 0;
				let rotation = 0;
				let opacity = fade;
				if (kappa > 1e-7) {
					const angle = (y + card.h / 2 - H / 2) * kappa;
					if (Math.abs(angle) > 1.52) {
						card.el.style.opacity = "0";
						continue;
					}
					ty = H / 2 + Math.sin(angle) / kappa - card.h / 2;
					tz = (Math.cos(angle) - 1) / kappa;
					rotation = -angle;
					opacity *= Math.cos(angle) ** 0.8;
				}
				card.el.style.transform = `translate3d(${reel.dx.toFixed(3)}px,${ty.toFixed(3)}px,${tz.toFixed(2)}px) rotateX(${rotation.toFixed(4)}rad)`;
				card.el.style.opacity = opacity.toFixed(3);
			}
		}
		raf = requestAnimationFrame(frame);
	};

	/* ---------- pointer: resting on a reel stops it, dragging flings it ---------- */

	for (const reel of reels) {
		const el = reel.el;
		let lastY = 0;
		let lastT = 0;
		let velocity = 0;
		let downX = 0;
		let downY = 0;
		let moved = false;
		el.addEventListener(
			"pointerenter",
			() => {
				reel.hoverTarget = 0;
			},
			{ signal },
		);
		el.addEventListener(
			"pointerleave",
			() => {
				if (!reel.dragging) {
					reel.hoverTarget = 1;
				}
			},
			{ signal },
		);
		el.addEventListener(
			"pointerdown",
			(event) => {
				// blue: the reels stay where they are
				if (blue) {
					return;
				}
				reel.dragging = true;
				reel.flingV = 0;
				velocity = 0;
				moved = false;
				lastY = downY = event.clientY;
				downX = event.clientX;
				lastT = performance.now();
				el.setPointerCapture(event.pointerId);
			},
			{ signal },
		);
		el.addEventListener(
			"pointermove",
			(event) => {
				if (!reel.dragging) {
					return;
				}
				if (
					!moved &&
					Math.hypot(event.clientX - downX, event.clientY - downY) > 5
				) {
					moved = true;
					el.classList.add("is-dragging");
				}
				if (!moved) {
					return;
				}
				const now = performance.now();
				const dy = event.clientY - lastY;
				const seconds = Math.max(1, now - lastT) / 1000;
				reel.flingPos += dy;
				velocity = velocity * 0.6 + (dy / seconds) * 0.4;
				lastY = event.clientY;
				lastT = now;
			},
			{ signal },
		);
		const end = (event: PointerEvent): void => {
			if (!reel.dragging) {
				return;
			}
			reel.dragging = false;
			el.classList.remove("is-dragging");
			if (moved) {
				// only a drag that is let go flings. one the browser took over,
				// to scroll the page or to zoom, stops where it is
				const idle = performance.now() - lastT;
				reel.flingV =
					event.type === "pointercancel" || idle > 90
						? 0
						: Math.max(-9000, Math.min(9000, velocity));
			}
			if (event.type === "pointercancel" || !el.matches(":hover")) {
				reel.hoverTarget = 1;
			}
		};
		el.addEventListener("pointerup", end, { signal });
		el.addEventListener("pointercancel", end, { signal });
	}

	/* ---------- the reveal: the copy waits for the reels ---------- */

	const timers: number[] = [];
	if (reduce) {
		host.classList.add("is-nav-in", "is-revealed", "is-settled");
	} else {
		timers.push(
			window.setTimeout(() => {
				host.classList.add("is-nav-in");
			}, 150),
			window.setTimeout(() => {
				host.classList.add("is-revealed");
			}, SPIN * 520),
			window.setTimeout(
				() => {
					host.classList.add("is-settled");
				},
				SPIN * 520 + 2600,
			),
		);
	}

	/* ---------- leaving: the page clears and the reels spin up again ---------- */

	const startExit = (): Promise<void> => {
		exiting = true;
		exitAt = performance.now();
		for (const reel of reels) {
			reel.outPos = 0;
			reel.flingV = 0;
		}
		document.documentElement.classList.add("home-exiting");
		return new Promise((resolve) => {
			window.setTimeout(resolve, EXIT_SECONDS * 1000);
		});
	};
	// the next page loads while the reels spin out, and shows once both are
	// done. going back or forward in history stays instant
	document.addEventListener(
		"astro:before-preparation",
		(event) => {
			if (reduce || exiting || event.navigationType === "traverse") {
				return;
			}
			const load = event.loader;
			event.loader = async () => {
				await Promise.all([load(), startExit()]);
			};
		},
		{ signal },
	);

	let resizeRaf = 0;
	window.addEventListener(
		"resize",
		() => {
			cancelAnimationFrame(resizeRaf);
			resizeRaf = requestAnimationFrame(() => {
				layout();
				fitList();
			});
		},
		{ signal },
	);

	layout();
	fitList();
	// the list's row heights depend on the font
	void document.fonts.ready.then(() => {
		if (!signal.aborted) {
			fitList();
		}
	});
	const now = performance.now();
	startIntro(now, reduce);
	last = now;
	raf = requestAnimationFrame(frame);

	return () => {
		abort.abort();
		cancelAnimationFrame(raf);
		cancelAnimationFrame(resizeRaf);
		clearTimers();
		for (const timer of timers) {
			window.clearTimeout(timer);
		}
		setBlue(false);
		showDock(false);
		document.documentElement.classList.remove("home-exiting");
		for (const element of bands) {
			element.style.height = "";
		}
		host.classList.remove("is-nav-in", "is-revealed", "is-settled");
	};
};

/** the landing page. the element wraps the whole page and runs its motion */
export class HomeStage extends HTMLElement {
	private _stop: (() => void) | undefined;

	connectedCallback(): void {
		this._stop?.();
		this._stop = start(this);
	}

	disconnectedCallback(): void {
		this._stop?.();
		this._stop = undefined;
	}
}

defineElementOnce("home-stage", HomeStage);
