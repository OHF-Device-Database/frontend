import type { Category } from "./device";

export const DEVICE_CATEGORIES: Category[] = [
    { id: "hubs", label: "Hubs, routers and bridges" },
    { id: "controls", label: "Buttons, switches and controls" },
    { id: "cameras", label: "Cameras and NVRs" },
    { id: "cleaning", label: "Cleaning" },
    { id: "climate", label: "Climate control" },
    { id: "irrigation", label: "Irrigation" },
    { id: "kitchen", label: "Kitchen and household" },
    { id: "lighting", label: "Lighting" },
    { id: "presence", label: "Occupancy, presence and motion" },
    { id: "pool", label: "Pool and spa" },
    { id: "pets", label: "Pets" },
    { id: "power", label: "Power and energy" },
    { id: "security", label: "Security and access control" },
    { id: "sensors", label: "Sensors" },
    { id: "entertainment", label: "Entertainment" },
    { id: "vehicles", label: "Vehicles and mobility" },
    { id: "wearables", label: "Wearables" },
    { id: "shading", label: "Window treatments and shading" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
    DEVICE_CATEGORIES.map((category) => [category.id, category.label]),
);
