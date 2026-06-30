import { z } from "astro/zod"
import { API_AUTHORITY } from "astro:env/server"

export const MAX_PAGE_SIZE = 50
export const BROWSE_PAGE_SIZE = 15
const REQUEST_TIMEOUT_MS = 8000

export const apiConfigured = Boolean(API_AUTHORITY)

function baseUrl(): string {
  if (!API_AUTHORITY) {
    throw new Error("API_AUTHORITY is not configured")
  }
  return /^https?:\/\//.test(API_AUTHORITY) ? API_AUTHORITY : `https://${API_AUTHORITY}`
}

export const ApiConnectivity = z.enum(["online", "offline"])
export type ApiConnectivity = z.infer<typeof ApiConnectivity>

const VersionEntry = z.object({
  version: z.string(),
  active: z.number().optional(),
  first_encountered: z.string().optional(),
})

const EntityEntry = z.object({
  domain: z.string(),
  original_device_class: z.string().optional(),
})

const DerivedDeviceBase = z.object({
  integration: z.object({
    name: z.string().optional(),
    domain: z.string(),
  }),
  manufacturer: z.string(),
  connectivity: ApiConnectivity.optional(),
  first_encountered: z.string().optional().default(""),
  versions: z
    .object({
      software: z.array(VersionEntry).default([]),
      hardware: z.array(VersionEntry).default([]),
    })
    .default({ software: [], hardware: [] }),
  categories: z.array(z.object({ id: z.string(), source: z.string().optional() })).default([]),
  entities: z.array(EntityEntry).default([]),
  model: z.string().optional(),
  model_id: z.string().optional(),
  count: z.number().default(0),
})

export const DerivedDevicePoly = DerivedDeviceBase.extend({ id: z.string() })
export type DerivedDevicePoly = z.infer<typeof DerivedDevicePoly>

export const DerivedDeviceMono = DerivedDeviceBase.extend({ id: z.string().optional() })
export type DerivedDeviceMono = z.infer<typeof DerivedDeviceMono>

const DerivedDeviceList = z.array(DerivedDevicePoly)

export const Dimensions = z.object({
  manufacturers: z.array(z.string()).default([]),
  connectivity: z.array(ApiConnectivity).default([]),
  categories: z.record(z.string(), z.unknown()).default({}),
})
export type Dimensions = z.infer<typeof Dimensions>

interface MemoEntry<T> {
  at: number
  value: Promise<T>
}

const memo = new Map<string, MemoEntry<unknown>>()

function now(): number {
  return Date.now()
}

function memoized<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key) as MemoEntry<T> | undefined
  if (hit && now() - hit.at < ttlMs) {
    return hit.value
  }
  const value = load().catch((error) => {
    memo.delete(key)
    throw error
  })
  memo.set(key, { at: now(), value })

  return value
}

async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  searchParams?: URLSearchParams,
): Promise<T> {
  const url = new URL(path, baseUrl())
  if (searchParams) {
    url.search = searchParams.toString()
  }

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`API ${res.status} for ${path}: ${body.slice(0, 200)}`)
  }

  return schema.parse(await res.json())
}

export interface DeviceQuery {
  page?: number
  size?: number
  term?: string
  category?: string[]
  notCategory?: string[]
  manufacturer?: string[]
  notManufacturer?: string[]
  connectivity?: ApiConnectivity[]
  notConnectivity?: ApiConnectivity[]
}

function queryToParams(query: DeviceQuery): URLSearchParams {
  const params = new URLSearchParams()
  const append = (key: string, values?: string[]) => {
    for (const value of values ?? []) {
      params.append(key, value)
    }
  }
  if (query.page !== undefined) params.set("page", String(query.page))
  if (query.size !== undefined) params.set("size", String(query.size))
  if (query.term?.trim()) params.set("term", query.term.trim())
  append("category", query.category)
  append("!category", query.notCategory)
  append("manufacturer", query.manufacturer)
  append("!manufacturer", query.notManufacturer)
  append("connectivity", query.connectivity)
  append("!connectivity", query.notConnectivity)

  return params
}

export interface DevicePage {
  devices: DerivedDevicePoly[]
  total: number
  page: number
  size: number
}

function parseTotal(contentRange: string | null, fallback: number): number {
  const match = contentRange?.match(/\/(\d+)\s*$/)

  return match ? Number(match[1]) : fallback
}

export function getDevicesPage(query: DeviceQuery = {}): Promise<DevicePage> {
  const size = Math.min(query.size ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE)
  const page = query.page ?? 0
  const params = queryToParams({ ...query, page, size })
  const key = `devices:page:${params.toString()}`

  return memoized(key, 60_000, async () => {
    const url = new URL("/api/unstable/derived/devices", baseUrl())
    url.search = params.toString()
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`API ${res.status} for devices: ${body.slice(0, 200)}`)
    }
    const devices = DerivedDeviceList.parse(await res.json())

    return {
      devices,
      total: parseTotal(res.headers.get("content-range"), devices.length),
      page,
      size,
    }
  })
}

export function getDeviceCount(): Promise<number> {
  return memoized("devices:count", 600_000, async () => {
    const { total } = await getDevicesPage({ page: 0, size: 10 })

    return total
  })
}

export function getDerivedDevice(id: string): Promise<DerivedDeviceMono | null> {
  return memoized(`device:${id}`, 60_000, async () => {
    const url = new URL(`/api/unstable/derived/devices/${encodeURIComponent(id)}`, baseUrl())
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (res.status === 404) {
      return null
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`API ${res.status} for device ${id}: ${body.slice(0, 200)}`)
    }

    return DerivedDeviceMono.parse(await res.json())
  })
}

export function getDimensions(): Promise<Dimensions> {
  return memoized("dimensions", 600_000, () => apiFetch("/api/unstable/dimensions", Dimensions))
}
