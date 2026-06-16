import { Device } from "./device";
import { MOCK_DEVICES } from "./mock-devices";
import { toUiCategory, toApiCategories } from "./category-map";
import { applyFilters, type BrowseFilters } from "./browse-filters";
import {
    apiConfigured,
    getDevicesPage,
    getDeviceCount,
    getDerivedDevice,
    getDimensions,
    MAX_PAGE_SIZE,
    type DeviceQuery,
    type DerivedDeviceMono,
    type DerivedDevicePoly,
} from "./api-client";

// ---------------------------------------------------------------------------
// Adapter: the live API's DerivedDevice DTO -> the UI's Device view model.
// This is the single boundary between the (unstable) API and the rest of the app,
// so shape changes only ripple through here.
// ---------------------------------------------------------------------------

/** Software/hardware versions arrive quote-wrapped, e.g. `"\"1.59.123\""`. */
function cleanVersion(raw: string | undefined): string {
    return (raw ?? "").replace(/^"+|"+$/g, "").trim();
}

function deviceName(dto: DerivedDeviceMono): string {
    return dto.model || dto.model_id || dto.integration.name || "Unknown device";
}

function toDevice(dto: DerivedDevicePoly | DerivedDeviceMono, id: string): Device {
    const software = dto.versions.software;
    return Device.parse({
        id,
        name: deviceName(dto),
        manufacturer: dto.manufacturer,
        model: dto.model_id || dto.model || "",
        category: toUiCategory(dto.categories.map((c) => c.id)),
        connectivity: dto.connectivity,
        summary: "",
        reports: dto.count,
        installs: dto.count,
        haIntegration: dto.integration.name || dto.integration.domain || "",
        entityTypes: [],
        softwareVersion: cleanVersion(software[software.length - 1]?.version),
        firstSeen: dto.first_encountered ?? "",
        lastVerified: "",
    });
}

/** Translate the UI's filter model into the API's server-side query parameters. */
function filtersToQuery(filters: BrowseFilters, page: number, size: number): DeviceQuery {
    const query: DeviceQuery = { page, size, term: filters.q };
    const categories = toApiCategories(filters.category);
    if (categories.length) {
        if (filters.categoryMode === "exclude") query.notCategory = categories;
        else query.category = categories;
    }
    const manufacturers = [...filters.manufacturer];
    if (manufacturers.length) {
        if (filters.manufacturerMode === "exclude") query.notManufacturer = manufacturers;
        else query.manufacturer = manufacturers;
    }
    // NOTE: `localOnly` has no server-side equivalent yet — the API exposes only
    // `connectivity` (online/offline), which is currently absent from the data — so it
    // is intentionally not mapped here. See the connectivity tri-state in device.ts.
    return query;
}

export interface DeviceResults {
    devices: Device[];
    total: number;
    page: number;
    size: number;
    pageCount: number;
}

// ---------------------------------------------------------------------------
// Public data access. Falls back to mock data when no API host is configured,
// so local development works without the backend.
// ---------------------------------------------------------------------------

export async function fetchDeviceResults(
    filters: BrowseFilters,
    page = 0,
    size = MAX_PAGE_SIZE,
): Promise<DeviceResults> {
    if (!apiConfigured) {
        const matched = applyFilters(
            MOCK_DEVICES.map((d) => Device.parse(d)),
            filters,
        );
        const start = page * size;
        return {
            devices: matched.slice(start, start + size),
            total: matched.length,
            page,
            size,
            pageCount: Math.max(1, Math.ceil(matched.length / size)),
        };
    }
    const result = await getDevicesPage(filtersToQuery(filters, page, size));
    return {
        devices: result.devices.map((dto) => toDevice(dto, dto.id)),
        total: result.total,
        page: result.page,
        size: result.size,
        pageCount: Math.max(1, Math.ceil(result.total / result.size)),
    };
}

/** Total number of devices in the database (cheap, cached). */
export async function fetchDeviceCount(): Promise<number> {
    if (!apiConfigured) {
        return MOCK_DEVICES.length;
    }
    return getDeviceCount();
}

/** Manufacturer names for the filter sidebar (from the dimensions endpoint). */
export async function fetchManufacturers(): Promise<string[]> {
    if (!apiConfigured) {
        return [...new Set(MOCK_DEVICES.map((d) => d.manufacturer))].sort((a, b) =>
            a.localeCompare(b),
        );
    }
    const { manufacturers } = await getDimensions();
    return manufacturers;
}

export async function fetchDevice(id: string): Promise<Device | undefined> {
    if (!apiConfigured) {
        const device = MOCK_DEVICES.find((candidate) => candidate.id === id);
        return device ? Device.parse(device) : undefined;
    }
    const dto = await getDerivedDevice(id);
    return dto ? toDevice(dto, id) : undefined;
}
