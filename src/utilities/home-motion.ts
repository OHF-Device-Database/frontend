/*
 * The arithmetic behind the landing page's motion, kept apart from the DOM
 * so it can be tested. The figures are the design handoff's.
 */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export const smooth = (x: number): number => x * x * (3 - 2 * x);

export const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** how far to move toward a target this frame, the same at any frame rate */
export const ease = (rate: number, dt: number): number =>
	1 - Math.exp(-dt * rate);

/**
 * a reel `t` seconds into its spin: it starts fast and lands on `distance`
 * with a quartic ease out
 */
export const spinIn = (
	t: number,
	distance: number,
	duration: number,
): { position: number; velocity: number } => {
	if (t >= duration) {
		return { position: distance, velocity: 0 };
	}
	const u = 1 - t / duration;
	return {
		position: distance * (1 - u ** 4),
		velocity: ((4 * distance) / duration) * u ** 3,
	};
};

/** the delay between reels, so the spin ends together however many show */
export const spinStagger = (reels: number, stagger: number): number =>
	stagger * Math.min(1, 3 / Math.max(1, reels - 1));

/** the list settles on a row: pulled 45% of the way to the nearest one */
export const detent = (position: number): number =>
	position + (Math.round(position) - position) * 0.45;

/** rows next to the reading line part slightly, in px */
export const rowParting = (distance: number): number =>
	Math.tanh(distance * 1.3) * 7;

/** rows fade with their distance from the reading line */
export const rowOpacity = (distance: number, section: number): number =>
	(1 - (Math.min(Math.abs(distance), 5) / 5) * 0.68) * (0.45 + 0.55 * section);

/** a timed change, not a scrub: moves toward 0 or 1 over `duration` seconds */
export const stepToward = (
	value: number,
	target: number,
	dt: number,
	duration: number,
): number => clamp01(value + (Math.sign(target - value) * dt) / duration);

/**
 * how far back over its line the list scrolls before the page leaves the
 * blue state. `rest` is where the list's top sits with the page at its top.
 * the slack is shorter where that is close to the line, so that scrolling
 * back up always leaves the blue state before the top
 */
export const switchSlack = (rest: number, line: number): number =>
	Math.min(160, Math.max(0, (rest - line) * 0.6));

/**
 * the height of footer band `index`, counted from the footer up. each band
 * opens after the one below it, which makes a stair and not a fade
 */
export const footerStep = (
	progress: number,
	index: number,
	bands: number,
	height: number,
): number =>
	height * smooth(clamp01((progress * (bands + 2)) / 2 - index * 0.5));
