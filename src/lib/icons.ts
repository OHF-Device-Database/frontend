import {
    Search,
    ArrowRight,
    ArrowLeft,
    Users,
    X,
    Pencil,
    Router,
    ToggleRight,
    Video,
    Bot,
    Thermometer,
    Droplets,
    Refrigerator,
    Lightbulb,
    Radar,
    Waves,
    PawPrint,
    Zap,
    Lock,
    Radio,
    Speaker,
    Car,
    Watch,
    Blinds,
    Check,
    ExternalLink,
    List,
    LayoutGrid,
    type IconNode,
} from "lucide";

const ICONS: Record<string, IconNode> = {
    search: Search,
    arrow: ArrowRight,
    arrowL: ArrowLeft,
    users: Users,
    x: X,
    pencil: Pencil,
    check: Check,
    open: ExternalLink,
    list: List,
    grid: LayoutGrid,
};

const GLYPHS: Record<string, IconNode> = {
    hubs: Router,
    controls: ToggleRight,
    cameras: Video,
    cleaning: Bot,
    climate: Thermometer,
    irrigation: Droplets,
    kitchen: Refrigerator,
    lighting: Lightbulb,
    presence: Radar,
    pool: Waves,
    pets: PawPrint,
    power: Zap,
    security: Lock,
    sensors: Radio,
    entertainment: Speaker,
    vehicles: Car,
    wearables: Watch,
    shading: Blinds,
};

function render(node: IconNode, size: number, strokeWidth: number, className?: string): string {
    const children = node
        .map(([tag, attrs]) => {
            const parts = Object.entries(attrs).map(([key, value]) => `${key}="${value}"`);
            return `<${tag} ${parts.join(" ")}/>`;
        })
        .join("");
    const classAttr = className ? ` class="${className}"` : "";
    return `<svg${classAttr} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
}

export function icon(name: string, size = 20, strokeWidth = 2): string {
    const node = ICONS[name] ?? Search;
    return render(node, size, strokeWidth, "icon");
}

export function categoryGlyph(category: string, size = 40): string {
    const node = GLYPHS[category] ?? GLYPHS.hubs;
    return render(node, size, 1.5);
}
