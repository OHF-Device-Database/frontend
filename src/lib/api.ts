import {
  apiConfigured,
  getDerivedDevice,
  getDeviceCount,
  getDevicesPage,
  getDimensions,
  MAX_PAGE_SIZE,
  type DerivedDeviceMono,
  type DerivedDevicePoly,
  type DeviceQuery,
} from "./api-client"
import { applyFilters, type BrowseFilters } from "./browse-filters"
import { toApiCategories, toUiCategory } from "./category-map"
import { Device } from "./device"
import { MOCK_DEVICES } from "./mock-devices"

function cleanVersion(raw: string | undefined): string {
  return (raw ?? "").replace(/^"+|"+$/g, "").trim()
}

function deviceName(dto: DerivedDeviceMono): string {
  return dto.model || dto.model_id || dto.integration.name || "Unknown device"
}

function toDevice(dto: DerivedDevicePoly | DerivedDeviceMono, id: string): Device {
  const software = dto.versions.software

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
  })
}

function filtersToQuery(filters: BrowseFilters, page: number, size: number): DeviceQuery {
  const query: DeviceQuery = { page, size, term: filters.q }
  const categories = toApiCategories(filters.category)
  if (categories.length) {
    if (filters.categoryMode === "exclude") query.notCategory = categories
    else query.category = categories
  }
  const manufacturers = [...filters.manufacturer]
  if (manufacturers.length) {
    if (filters.manufacturerMode === "exclude") query.notManufacturer = manufacturers
    else query.manufacturer = manufacturers
  }

  return query
}

export interface DeviceResults {
  devices: Device[]
  total: number
  page: number
  size: number
  pageCount: number
}

export async function fetchDeviceResults(
  filters: BrowseFilters,
  page = 0,
  size = MAX_PAGE_SIZE,
): Promise<DeviceResults> {
  if (!apiConfigured) {
    const matched = applyFilters(
      MOCK_DEVICES.map((d) => Device.parse(d)),
      filters,
    )
    const start = page * size

    return {
      devices: matched.slice(start, start + size),
      total: matched.length,
      page,
      size,
      pageCount: Math.max(1, Math.ceil(matched.length / size)),
    }
  }
  const result = await getDevicesPage(filtersToQuery(filters, page, size))

  return {
    devices: result.devices.map((dto) => toDevice(dto, dto.id)),
    total: result.total,
    page: result.page,
    size: result.size,
    pageCount: Math.max(1, Math.ceil(result.total / result.size)),
  }
}

export async function fetchDeviceCount(): Promise<number> {
  if (!apiConfigured) {
    return MOCK_DEVICES.length
  }

  return getDeviceCount()
}

export async function fetchManufacturers(): Promise<string[]> {
  if (!apiConfigured) {
    return [...new Set(MOCK_DEVICES.map((d) => d.manufacturer))].sort((a, b) => a.localeCompare(b))
  }
  const { manufacturers } = await getDimensions()

  return manufacturers
}

export async function fetchDevice(id: string): Promise<Device | undefined> {
  if (!apiConfigured) {
    const device = MOCK_DEVICES.find((candidate) => candidate.id === id)
    return device ? Device.parse(device) : undefined
  }
  const dto = await getDerivedDevice(id)

  return dto ? toDevice(dto, id) : undefined
}
