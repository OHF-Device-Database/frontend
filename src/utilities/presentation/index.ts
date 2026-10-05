import {
	ArrowLeft,
	ArrowRight,
	Blinds,
	Bot,
	Car,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleQuestionMark,
	CloudSun,
	Droplet,
	Droplets,
	ExternalLink,
	Funnel,
	Languages,
	LayoutGrid,
	Lightbulb,
	Link,
	List,
	Lock,
	PawPrint,
	Pencil,
	Printer,
	Radar,
	Refrigerator,
	Router,
	Search,
	Speaker,
	Sprout,
	Thermometer,
	ToggleRight,
	TriangleAlert,
	Users,
	Waves,
	X,
	Zap,
} from "lucide";
import type { IconNode } from "lucide";

import { m } from "../../paraglide/messages.js";
import { Unknown } from "../../types/unknown";
import { peek } from "./preset";
import type { DeviceCategoryTopLevelId } from "../../types/category";
import type { DeviceConnectivityId, DeviceMono } from "../../types/device";
import type { QuickFilterId } from "../../types/quick-filter";
import type { PresentationRenderPreset } from "./preset";

type PresentationLazyLabeled = {
	label: () => string;
};

const PresentationRenderableSymbol = Symbol("PresentationIconRenderable");
type PresentationRenderableInner = IconNode;
type PresentationRenderable = {
	renderable: {
		[PresentationRenderableSymbol]: PresentationRenderableInner;
	};
};
const renderable = (inner: PresentationRenderableInner) =>
	({ renderable: { [PresentationRenderableSymbol]: inner } }) as const;

type PresentationStylesheetClass = {
	cls: string;
};

type PresentationStylesheetColor = {
	color: string;
};

const PRESENTATION_ENTITY_DEVICE_CONNECTIVITY = {
	online: {
		cls: "net-yes",
		label: m.connectivity_requires_internet,
		color: "var(--neutral-400)",
	},
	offline: {
		cls: "net-no",
		label: m.connectivity_local,
		color: "var(--success)",
	},
} as const satisfies Record<
	DeviceConnectivityId,
	PresentationLazyLabeled &
		PresentationStylesheetClass &
		PresentationStylesheetColor
>;

const PRESENTATION_ENTITY_DEVICE_CATEGORY = {
	"button-switch-and-control": {
		...renderable(ToggleRight),
		label: m.category_button_switch_and_control,
	},
	cleaning: { ...renderable(Bot), label: m.category_cleaning },
	"climate-control": {
		...renderable(Thermometer),
		label: m.category_climate_control,
	},
	cover: { ...renderable(Blinds), label: m.category_cover },
	entertainment: { ...renderable(Speaker), label: m.category_entertainment },
	garden: { ...renderable(Sprout), label: m.category_garden },
	irrigation: { ...renderable(Droplets), label: m.category_irrigation },
	"kitchen-and-household": {
		...renderable(Refrigerator),
		label: m.category_kitchen_and_household,
	},
	lighting: { ...renderable(Lightbulb), label: m.category_lighting },
	monitoring: { ...renderable(Radar), label: m.category_monitoring },
	networking: { ...renderable(Router), label: m.category_networking },
	pets: { ...renderable(PawPrint), label: m.category_pets },
	"pool-and-spa": { ...renderable(Waves), label: m.category_pool_and_spa },
	"power-and-energy": {
		...renderable(Zap),
		label: m.category_power_and_energy,
	},
	printing: { ...renderable(Printer), label: m.category_printing },
	"security-and-access-control": {
		...renderable(Lock),
		label: m.category_security_and_access_control,
	},
	"vehicle-and-mobility": {
		...renderable(Car),
		label: m.category_vehicle_and_mobility,
	},
	"water-management": {
		...renderable(Droplet),
		label: m.category_water_management,
	},
	weather: { ...renderable(CloudSun), label: m.category_weather },
} as const satisfies Record<
	DeviceCategoryTopLevelId,
	PresentationRenderable & PresentationLazyLabeled
>;

const PRESENTATION_ENTITY_QUICK_FILTER = {
	"sensors-local": {
		...renderable(Radar),
		label: m.quick_filter_sensors_local,
	},
	"lighting-local": {
		...renderable(Lightbulb),
		label: m.quick_filter_lighting_local,
	},
	energy: { ...renderable(Zap), label: m.quick_filter_energy },
} as const satisfies Record<
	QuickFilterId,
	PresentationRenderable & PresentationLazyLabeled
>;

const PRESENTATION_GENERIC = {
	search: renderable(Search),
	filter: renderable(Funnel),
	arrow: renderable(ArrowRight),
	arrowL: renderable(ArrowLeft),
	users: renderable(Users),
	x: renderable(X),
	pencil: renderable(Pencil),
	check: renderable(Check),
	open: renderable(ExternalLink),
	list: renderable(List),
	grid: renderable(LayoutGrid),
	chevronL: renderable(ChevronLeft),
	chevronR: renderable(ChevronRight),
	chevronDown: renderable(ChevronDown),
	languages: renderable(Languages),
	link: renderable(Link),
	warning: renderable(TriangleAlert),
} as const;

export const device = {
	name: (self: Pick<DeviceMono, "model" | "modelId">): string => {
		if (
			typeof self.model !== "undefined" &&
			typeof self.modelId !== "undefined"
		) {
			if (self.model === self.modelId) {
				return self.model;
			}
			return `${self.model} (${self.modelId})`;
		} else if (typeof self.model !== "undefined") {
			return self.model;
		} else {
			return self.modelId!;
		}
	},
	connectivity: (self: DeviceConnectivityId | Unknown) => {
		if (self === Unknown) {
			return {
				cls: "net-unknown",
				label: m.connectivity_unknown(),
				color: "var(--neutral-400)",
			} as const;
		}
		const { label, ...rest } = PRESENTATION_ENTITY_DEVICE_CONNECTIVITY[self];
		return { ...rest, label: label() };
	},
	category: (self: DeviceCategoryTopLevelId | Unknown) => {
		if (self === Unknown) {
			return {
				...renderable(CircleQuestionMark),
				label: m.category_unknown(),
			} as const;
		}
		const { label, ...rest } = PRESENTATION_ENTITY_DEVICE_CATEGORY[self];
		return { ...rest, label: label() };
	},
};
export const quickFilter = (self: QuickFilterId) => {
	const { label, ...rest } = PRESENTATION_ENTITY_QUICK_FILTER[self];
	return { ...rest, label: label() };
};

export const generic = (self: keyof typeof PRESENTATION_GENERIC) =>
	PRESENTATION_GENERIC[self];

export const render = (
	renderable: PresentationRenderable,
	preset: PresentationRenderPreset,
) => {
	const peekedRenderable = renderable.renderable[PresentationRenderableSymbol];
	const peekedPreset = peek(preset);

	const children = peekedRenderable
		.map(([tag, attrs]) => {
			const parts = Object.entries(attrs).map(
				([key, value]) => `${key}="${value}"`,
			);
			return `<${tag} ${parts.join(" ")}/>`;
		})
		.join("");
	const classAttr =
		typeof peekedPreset.cls !== "undefined"
			? ` class="${peekedPreset.cls}"`
			: "";
	return `<svg${classAttr} xmlns="http://www.w3.org/2000/svg" width="${peekedPreset.size}" height="${peekedPreset.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${peekedPreset.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
};
