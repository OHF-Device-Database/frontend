import type { Category, Device } from "./device";
import { applyFilters, EMPTY_BROWSE_FILTERS } from "./browse-filters";
import { MOCK_DEVICES } from "./mock-devices";
import { DEVICE_CATEGORIES } from "./categories";

const STOPWORDS = new Set([
    "the", "and", "for", "with", "via", "not", "but", "only", "can", "may", "over", "this",
    "that", "into", "when", "also", "does", "has", "have", "its", "they", "them", "from",
    "than", "then", "use", "used", "uses", "one", "two", "plus", "gen", "pro", "ultra",
    "mini", "new", "are", "was", "were", "will", "you", "your", "any", "all", "each", "both",
    "such", "other", "out", "off", "yes", "required", "optional", "still", "every", "most",
    "more", "less", "between", "across", "without", "under", "like", "just", "very",
]);

const WORD_CORPUS = (() => {
    const counts: Record<string, number> = {};
    const bump = (text: string) => {
        for (const word of text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []) {
            if (STOPWORDS.has(word)) {
                continue;
            }
            counts[word] = (counts[word] ?? 0) + 1;
        }
    };
    for (const device of MOCK_DEVICES) {
        bump(device.name);
        bump(device.manufacturer);
        bump(device.summary);
    }
    for (const category of DEVICE_CATEGORIES) {
        bump(category.label);
    }
    return counts;
})();

export interface QuickFilter {
    id: string;
    title: string;
    icon: string;
    breadcrumb: string;
    filters: { category?: string[]; manufacturer?: string[]; localOnly?: boolean };
}

export const QUICK_FILTERS: QuickFilter[] = [
    {
        id: "sensors-local",
        title: "Sensors with local connection",
        icon: "sensors",
        breadcrumb: "Sensors · Occupancy and motion · Local connection",
        filters: { category: ["sensors", "presence"], localOnly: true },
    },
    {
        id: "lighting-local",
        title: "Lighting with local connection",
        icon: "lighting",
        breadcrumb: "Lighting · Local connection",
        filters: { category: ["lighting"], localOnly: true },
    },
    {
        id: "cameras-local",
        title: "Cameras with local connection",
        icon: "cameras",
        breadcrumb: "Cameras and NVRs · Local connection",
        filters: { category: ["cameras"], localOnly: true },
    },
    {
        id: "switches-local",
        title: "Switches with local connection",
        icon: "controls",
        breadcrumb: "Buttons, switches and controls · Local connection",
        filters: { category: ["controls"], localOnly: true },
    },
    {
        id: "hubs",
        title: "Hubs and bridges",
        icon: "hubs",
        breadcrumb: "Hubs, routers and bridges",
        filters: { category: ["hubs"] },
    },
    {
        id: "energy",
        title: "Energy monitoring",
        icon: "power",
        breadcrumb: "Power and energy",
        filters: { category: ["power"] },
    },
];

export function countMatchingQuickFilter(filters: QuickFilter["filters"]): number {
    return applyFilters(MOCK_DEVICES, {
        ...EMPTY_BROWSE_FILTERS,
        category: new Set(filters.category ?? []),
        manufacturer: new Set(filters.manufacturer ?? []),
        localOnly: !!filters.localOnly,
    }).length;
}

export interface Suggestions {
    categories?: Category[];
    devices?: Device[];
    deviceMore?: number;
    manufacturers?: string[];
    words?: string[];
}

export function buildSuggestions(q: string): Suggestions | null {
    const term = q.trim().toLowerCase();
    if (!term) {
        return null;
    }

    const out: Suggestions = {};

    out.categories = DEVICE_CATEGORIES.filter((c) =>
        c.label.toLowerCase().includes(term),
    ).slice(0, 5);

    const allDevices = MOCK_DEVICES.filter((d) =>
        `${d.name} ${d.manufacturer} ${d.model}`.toLowerCase().includes(term),
    );
    out.devices = allDevices.slice(0, 5);
    out.deviceMore = allDevices.length > 5 ? allDevices.length : 0;

    const seen = new Set<string>();
    const manus: string[] = [];
    for (const device of MOCK_DEVICES) {
        if (seen.has(device.manufacturer)) {
            continue;
        }
        if (!device.manufacturer.toLowerCase().includes(term)) {
            continue;
        }
        seen.add(device.manufacturer);
        manus.push(device.manufacturer);
        if (manus.length >= 5) {
            break;
        }
    }
    out.manufacturers = manus;

    out.words = Object.entries(WORD_CORPUS)
        .filter(([w]) => w.startsWith(term) && w !== term)
        .sort((a, b) => b[1] - a[1])
        .map(([w]) => w)
        .slice(0, 5);

    for (const key of Object.keys(out) as (keyof Suggestions)[]) {
        const value = out[key];
        if (Array.isArray(value) && value.length === 0) {
            delete out[key];
        }
    }

    const hasSections = (["categories", "devices", "manufacturers", "words"] as const).some(
        (key) => out[key] && out[key]!.length > 0,
    );
    return hasSections ? out : null;
}
