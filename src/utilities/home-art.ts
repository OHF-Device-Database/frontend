import type { DeviceCategoryTopLevelId } from "../types/category";

/*
 * The drawings on the landing page's cards. They are the animated category
 * drawings from `src/assets/illustrations/categories/`, named here without
 * the "-animated.svg" ending. The designer drew 18 groups and the API has 19
 * top level categories that only partly match, so a few categories borrow
 * the nearest drawings.
 */

const four = (group: string, a: string, b: string, c: string) =>
	[group, `${group}-${a}`, `${group}-${b}`, `${group}-${c}`] as const;

const drawn = {
	buttons: four("buttons", "button", "dimmer", "remote"),
	cameras: four("cameras", "dome", "indoor", "nvr"),
	cleaning: four("cleaning", "dock", "stick", "window"),
	climate: four("climate", "ac", "purifier", "trv"),
	entertainment: four("entertainment", "soundbar", "speaker", "streamer"),
	hubs: four("hubs", "dongle", "mesh", "router"),
	irrigation: four("irrigation", "controller", "soil", "timer"),
	kitchen: four("kitchen", "coffee", "fridge", "washer"),
	lighting: four("lighting", "lamp", "pendant", "strip"),
	occupancy: four("occupancy", "bed", "doorway", "motion"),
	pets: four("pets", "door", "fountain", "litter"),
	pool: four("pool", "pump", "robot", "spa"),
	power: four("power", "meter", "solar", "strip"),
	security: four("security", "garage", "lock", "siren"),
	sensors: four("sensors", "air", "contact", "leak"),
	vehicles: four("vehicles", "dashcam", "obd", "post"),
	wearables: four("wearables", "band", "pendant", "ring"),
	window: four("window", "awning", "curtain", "venetian"),
} as const;

/** one drawing from every group, for a category with nothing of its own */
const mixed = Object.values(drawn).map(([first]) => first);

export const HOME_CATEGORY_DRAWINGS: Record<
	DeviceCategoryTopLevelId,
	readonly string[]
> = {
	"button-switch-and-control": drawn.buttons,
	cleaning: drawn.cleaning,
	"climate-control": drawn.climate,
	cover: drawn.window,
	entertainment: drawn.entertainment,
	garden: ["irrigation-soil", "irrigation", "irrigation-timer", "power-solar"],
	irrigation: drawn.irrigation,
	"kitchen-and-household": drawn.kitchen,
	lighting: drawn.lighting,
	monitoring: [...drawn.sensors, ...drawn.occupancy],
	networking: drawn.hubs,
	pets: drawn.pets,
	"pool-and-spa": drawn.pool,
	"power-and-energy": drawn.power,
	printing: mixed,
	"security-and-access-control": [...drawn.security, ...drawn.cameras],
	"vehicle-and-mobility": drawn.vehicles,
	"water-management": [
		"sensors-leak",
		"irrigation-timer",
		"irrigation-controller",
		"pool-pump",
	],
	weather: ["sensors-air", "sensors", "climate", "power-solar"],
};

/** every drawing a card can show when no category is in focus */
export const HOME_DRAWINGS: readonly string[] = Object.values(drawn).flat();

export const HOME_PALETTES = [
	"sand",
	"carbon",
	"umber",
	"cobalt",
	"linen",
] as const;
export type HomePalette = (typeof HOME_PALETTES)[number];

/** an empty dashed frame, or a card in a colour with a drawing on it */
export type HomeCardSpec =
	| { kind: "dash" }
	| { kind: HomePalette; drawing: string; figure: string | undefined };

/** card height over its width: a short and a tall card */
const S = 1.13;
const T = 1.28;

type Slot = readonly [
	ratio: number,
	card?: HomePalette,
	drawing?: string,
	figure?: string,
];

/** the cards each reel opens with, top to bottom, as laid out in the design */
export const HOME_OPENING: readonly (readonly Slot[])[] = [
	[
		[S, "sand", "lighting", "FIG. 1."],
		[S],
		[S, "umber", "buttons-dimmer"],
		[T],
		[S, "carbon", "climate", "FIG. 5."],
		[S],
		[T, "linen", "power"],
		[S],
	],
	[
		[T],
		[T],
		[T],
		[S],
		[S, "cobalt", "entertainment-speaker"],
		[T],
		[T, "sand", "occupancy-motion", "FIG. 6."],
		[S],
	],
	[
		[S, "carbon", "sensors", "FIG. 2."],
		[S],
		[S, "cobalt", "hubs-dongle"],
		[T],
		[T, "umber", "entertainment"],
		[S],
		[S, "linen", "security-lock"],
		[T],
	],
	[
		[T],
		[T],
		[T, "linen", "lighting-pendant"],
		[T],
		[S, "sand", "climate-trv", "FIG. 4."],
		[S],
		[T, "carbon", "power-meter", "FIG. 3."],
		[S],
	],
];

export const homeSlotRatio = ([ratio]: Slot): number => ratio;

export const homeSlotSpec = ([, kind, drawing, figure]: Slot): HomeCardSpec =>
	kind === undefined || drawing === undefined
		? { kind: "dash" }
		: { kind, drawing, figure };

export const homeArtId = (drawing: string): string => `home-art-${drawing}`;

const ROOT = /^<svg[^>]*\sviewBox="(?<viewBox>[^"]*)"[^>]*>/;
const STYLE = /<style>[\s\S]*?<\/style>/;

/**
 * a drawing file as a `<symbol>`. its own style block goes, since it would
 * style the whole page once inlined; `src/styles/home.css` draws it instead
 */
export const homeArtSymbol = (drawing: string, svg: string): string => {
	const root = ROOT.exec(svg);
	const viewBox = root?.groups?.["viewBox"];
	const end = svg.lastIndexOf("</svg>");
	if (root === null || viewBox === undefined || end === -1) {
		throw new Error(`unexpected drawing file for "${drawing}"`);
	}

	const inner = svg.slice(root[0].length, end).replace(STYLE, "");
	// the group carries the class the styles hang on: a card shows the symbol
	// with `<use>`, and only what is inside the symbol can be matched there
	return `<symbol id="${homeArtId(drawing)}" viewBox="${viewBox}" overflow="visible"><g class="home-art">${inner}</g></symbol>`;
};
