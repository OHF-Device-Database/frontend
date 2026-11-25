import { defineElementOnce } from "../utilities/define-element.js";
import {
	rolodexDrawing,
	rolodexEase,
	rolodexSettle,
} from "../utilities/rolodex.js";

/** degrees the wheel turns for a pixel of scroll, when the element sets none */
const TURN_PER_PIXEL = 0.18;
/** how long after the last scroll the wheel settles on a card */
const SETTLE_AFTER_MS = 140;

/**
 * the rolodex on the Contributors page, after the design handoff's component.
 * it turns as the page scrolls and settles on a card once the scrolling stops.
 * the page draws the wheel at rest on the server, so the drawing is there
 * before this runs, without it, and with reduced motion, where it never turns
 */
export class RolodexArt extends HTMLElement {
	/** degrees the wheel has turned, and where it is heading */
	private _turn = 0;
	private _target = 0;
	/** the turn the drawing on the page shows */
	private _drawn = "";
	private _settleAt = 0;
	private _lastScroll = 0;
	private _lastFrame = 0;
	private _frame = 0;
	private _ready = 0;
	private _visible = false;
	private _observer: IntersectionObserver | undefined;
	private readonly _reduce = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	);

	connectedCallback(): void {
		if (this.querySelector("svg") === null) {
			this._draw();
		} else {
			this._drawn = this._turn.toFixed(2);
		}

		// the router moves the scroll right after it swaps a page in. waiting a
		// frame keeps that jump from being read as a scroll
		this._ready = requestAnimationFrame(() => {
			this._ready = 0;
			this._lastScroll = window.scrollY;
			window.addEventListener("scroll", this._onScroll, { passive: true });
		});

		this._observer = new IntersectionObserver(
			([entry]) => {
				this._visible = entry?.isIntersecting === true;
				if (this._visible) {
					this._run();
				}
			},
			{ rootMargin: "100px" },
		);
		this._observer.observe(this);
	}

	disconnectedCallback(): void {
		window.removeEventListener("scroll", this._onScroll);
		this._observer?.disconnect();
		cancelAnimationFrame(this._ready);
		cancelAnimationFrame(this._frame);
		this._ready = 0;
		this._frame = 0;
	}

	private get _rate(): number {
		const rate = Number.parseFloat(this.getAttribute("turn") ?? "");

		return Number.isFinite(rate) ? rate : TURN_PER_PIXEL;
	}

	private _onScroll = (): void => {
		const scroll = window.scrollY;
		const by = (this._lastScroll - scroll) * this._rate;
		this._lastScroll = scroll;
		if (this._reduce.matches) {
			return;
		}

		this._target += by;
		if (!this._visible) {
			// off screen it keeps up, so it has no catching up to do on the way back
			this._turn += by;
			return;
		}

		this._settleAt = performance.now() + SETTLE_AFTER_MS;
		this._run();
	};

	/** starts the frames. they stop on their own once the wheel has settled */
	private _run(): void {
		if (this._frame !== 0 || !this._visible) {
			return;
		}

		this._lastFrame = performance.now();
		this._frame = requestAnimationFrame(this._step);
	}

	private _step = (now: number): void => {
		this._frame = 0;
		const dt = Math.min(0.05, Math.max(0, (now - this._lastFrame) / 1000));
		this._lastFrame = now;

		const scrolling = now <= this._settleAt;
		if (!scrolling) {
			this._target = rolodexSettle(this._target);
		}
		this._turn = rolodexEase(this._turn, this._target, dt);
		this._draw();

		if (scrolling || this._turn !== this._target) {
			this._frame = requestAnimationFrame(this._step);
		}
	};

	private _draw(): void {
		const turn = this._turn.toFixed(2);
		if (turn === this._drawn) {
			return;
		}

		this._drawn = turn;
		this.innerHTML = rolodexDrawing(this._turn);
	}
}

defineElementOnce("rolodex-art", RolodexArt);
