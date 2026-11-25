/*
 * The rolodex on the Contributors page, drawn the way the design handoff's
 * component draws it: a base, two posts, a drum and a fan of cards in an
 * isometric projection, for any turn of the wheel. Kept apart from the DOM so
 * the page can draw it on the server and so it can be tested.
 */

type Point = readonly [x: number, y: number];
type Point3 = readonly [x: number, y: number, z: number];

/** degrees from one card to the next */
export const ROLODEX_STEP = 18;

/** the card standing at the top carries this class */
export const ROLODEX_CARD_ON = "rolodex-card-on";
/** the two lines written on that card */
export const ROLODEX_LINE = "rolodex-line";

/**
 * the bounds of the base and of a full turn of the cards, with 6 to spare
 * on every side. the wheel never draws outside it
 */
export const ROLODEX_VIEW_BOX = "-35.44 -57.82 70.89 75.82";

const COS_30 = Math.cos(Math.PI / 6);
/** height of the axis above the ground */
const AXIS = 23;
/** half the width of a card */
const HALF = 13;
/** a card runs from the drum out to its edge */
const INNER = 6;
const OUTER = 20;
/** where a card stands when it is the one at the top */
const TOP = 90;
/** a card unfolds from the drum over this many degrees */
const FOLD_FROM = -44;
const FOLD_OVER = 20;

const fixed = (value: number): number => Number(value.toFixed(2));

const project = ([x, y, z]: Point3): Point => [
	(x - y) * COS_30,
	(x + y) * 0.5 - z,
];

const through = (points: readonly Point[]): string =>
	`M${points.map(([x, y]) => `${fixed(x)} ${fixed(y)}`).join("L")}`;

const path = (d: string, className?: string): string =>
	`<path${typeof className === "undefined" ? "" : ` class="${className}"`} d="${d}"/>`;

const face = (corners: readonly Point3[], className?: string): string =>
	path(`${through(corners.map(project))}Z`, className);

/** the convex outline round a set of points */
const hull = (points: readonly Point[]): Point[] => {
	const cross = (o: Point, a: Point, b: Point): number =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

	const chain = (ordered: readonly Point[]): Point[] => {
		const kept: Point[] = [];
		for (const point of ordered) {
			for (;;) {
				const before = kept.at(-2);
				const last = kept.at(-1);
				if (
					typeof before === "undefined" ||
					typeof last === "undefined" ||
					cross(before, last, point) > 0
				) {
					break;
				}
				kept.pop();
			}
			kept.push(point);
		}

		return kept.slice(0, -1);
	};

	const ordered = points.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);

	return [...chain(ordered), ...chain(ordered.toReversed())];
};

/** the three faces of a box that show: top, right and front */
const box = (
	x: number,
	y: number,
	z: number,
	width: number,
	depth: number,
	height: number,
): string => {
	const right = x + width;
	const front = y + depth;
	const top = z + height;

	return (
		face([
			[x, y, top],
			[right, y, top],
			[right, front, top],
			[x, front, top],
		]) +
		face([
			[right, y, z],
			[right, front, z],
			[right, front, top],
			[right, y, top],
		]) +
		face([
			[x, front, z],
			[right, front, z],
			[right, front, top],
			[x, front, top],
		])
	);
};

/** a circle round the axis at `x` */
const ring = (x: number, radius: number, steps = 48): Point[] =>
	Array.from({ length: steps }, (_, step) => {
		const angle = (step / steps) * 2 * Math.PI;

		return project([
			x,
			radius * Math.cos(angle),
			AXIS + radius * Math.sin(angle),
		]);
	});

/** a cylinder along the axis: its side, then the end that faces the viewer */
const cylinder = (from: number, to: number, radius: number): string => {
	const end = ring(to, radius);

	return (
		path(`${through(hull([...ring(from, radius), ...end]))}Z`) +
		path(`${through(end)}Z`)
	);
};

/** a piece of the drawing, with how far forward it sits */
type Part = { markup: string; depth: number; angle: number };

/** the parts that never move */
const FRAME: readonly Part[] = [
	{ markup: box(-20, -14, 0, 40, 28, 5), depth: -1000 },
	// the drum the cards hang from
	{ markup: cylinder(-HALF - 1, HALF + 1, INNER), depth: -999 },
	// a post and a knob at either end of the axis
	{ markup: box(-17.5, -2, 5, 2.5, 4, AXIS - 5), depth: -17.5 + AXIS / 2 },
	{ markup: box(15, -2, 5, 2.5, 4, AXIS - 5), depth: 16.25 + AXIS / 2 },
	{ markup: cylinder(-20, -17.5, 5), depth: -18.75 + AXIS },
	{ markup: cylinder(17.5, 20, 5), depth: 18.75 + AXIS },
].map((part) => ({ ...part, angle: 0 }));

/** an angle in degrees, brought into -180 up to 180 */
const wrap = (degrees: number): number =>
	((((degrees + 180) % 360) + 360) % 360) - 180;

/**
 * where the cards stand with the wheel turned by `turn` degrees. a card comes
 * into the fan lying flat at the back and folds into the drum at the front
 */
export const rolodexCards = (
	turn: number,
): { angle: number; reach: number; on: boolean }[] =>
	Array.from({ length: 360 / ROLODEX_STEP }, (_, card) =>
		wrap(card * ROLODEX_STEP + turn),
	).flatMap((angle) => {
		if (angle < FOLD_FROM) {
			return [];
		}

		const open = Math.min(1, (angle - FOLD_FROM) / FOLD_OVER);
		const reach = INNER + (OUTER - INNER) * open * open * (3 - 2 * open);

		// too short to draw
		return reach - INNER < 0.6
			? []
			: [{ angle, reach, on: Math.abs(angle - TOP) < ROLODEX_STEP / 2 }];
	});

/** the wheel as svg markup, turned by `turn` degrees */
export const rolodexDrawing = (turn: number): string => {
	const cards = rolodexCards(turn).map(({ angle, reach, on }): Part => {
		const radians = (angle * Math.PI) / 180;
		const at = (x: number, radius: number): Point3 => [
			x,
			radius * Math.cos(radians),
			AXIS + radius * Math.sin(radians),
		];

		let markup = face(
			[at(-HALF, INNER), at(HALF, INNER), at(HALF, reach), at(-HALF, reach)],
			on ? ROLODEX_CARD_ON : undefined,
		);
		if (on) {
			for (const [inset, length] of [
				[4.5, 13],
				[8, 8],
			] as const) {
				markup += path(
					through([
						project(at(-HALF + 3, reach - inset)),
						project(at(-HALF + 3 + length, reach - inset)),
					]),
					ROLODEX_LINE,
				);
			}
		}

		// the middle of the card decides what it hides
		const [x, y, z] = at(0, (INNER + reach) / 2);

		return { markup, depth: x + y + z, angle };
	});

	// two cards can sit equally far forward. they never overlap, and going by
	// their angle then keeps the markup the same for the same wheel
	const parts = [...FRAME, ...cards].toSorted(
		(a, b) => a.depth - b.depth || a.angle - b.angle,
	);

	return `<svg viewBox="${ROLODEX_VIEW_BOX}" aria-hidden="true" focusable="false">${parts.map(({ markup }) => markup).join("")}</svg>`;
};

/**
 * the wheel's angle one frame on: it eases toward `target`, the same at any
 * frame rate, and lands on it once it is close
 */
export const rolodexEase = (
	turn: number,
	target: number,
	dt: number,
): number => {
	const next = turn + (target - turn) * (1 - Math.exp(-dt * 9));

	return Math.abs(target - next) < 0.01 ? target : next;
};

/** the nearest angle at which a card stands at the top */
export const rolodexSettle = (turn: number): number =>
	Math.round(turn / ROLODEX_STEP) * ROLODEX_STEP;
