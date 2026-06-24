/* Stage 03 — community editing, client only.
 *
 * There is no backend yet, so this module is the whole "backend": current user,
 * drafts, and submitted edits all live in localStorage. Mutators dispatch a
 * `devicedb:community` window event so Lit islands re-render. When a real API
 * lands, only the read/write internals here change; the island contract stays.
 */

const STORAGE_KEY = "devicedb.community.v1"
export const COMMUNITY_EVENT = "devicedb:community"

/* ---------- Types ---------- */

export interface CommunityUser {
  id: string
  name: string
  login: string
  /** Seed colour for the generated monogram avatar. */
  color: string
}

export interface Reference {
  label: string
  url: string
}

/** The contributor-editable overlay for a device. Never the reported verdict. */
export interface ContributorFields {
  description: string
  references: Reference[]
}

export type SubmissionStatus = "pending" | "live" | "declined"

export interface Submission {
  id: string
  deviceId: string
  deviceName: string
  manufacturer: string
  category: string
  fields: ContributorFields
  changedKeys: ContributorFieldKey[]
  status: SubmissionStatus
  by: string
  submittedAt: string
  prNumber: number
}

export interface Draft {
  deviceId: string
  deviceName: string
  manufacturer: string
  category: string
  fields: ContributorFields
  updatedAt: string
  by: string
}

interface CommunityState {
  currentUserId: string | null
  drafts: Record<string, Draft>
  submissions: Submission[]
  nextPr: number
}

export interface DeviceRef {
  id: string
  name: string
  manufacturer: string
  category: string
}

/* ---------- Contributor field metadata ---------- */

export type ContributorFieldKey = keyof ContributorFields

export const CONTRIBUTOR_FIELD_LABEL: Record<ContributorFieldKey, string> = {
  description: "Overview",
  references: "References",
}

export const EMPTY_FIELDS: ContributorFields = { description: "", references: [] }

/* ---------- Demo identities (fake OAuth) ---------- */

export const DEMO_USERS: CommunityUser[] = [
  { id: "robinhass", name: "Robin Haß", login: "robinhass", color: "#e85a1a" },
  { id: "mxptr", name: "Max Petrov", login: "mxptr", color: "#3d6b3a" },
  { id: "lin-ito", name: "Lin Ito", login: "lin-ito", color: "#2a6f97" },
]

/* ---------- Status labels ---------- */

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "Awaiting review",
  live: "Live",
  declined: "Declined",
}

/* ---------- Persistence ---------- */

function blankState(): CommunityState {
  return { currentUserId: null, drafts: {}, submissions: [], nextPr: 240 }
}

function read(): CommunityState {
  if (typeof localStorage === "undefined") {
    return blankState()
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return blankState()
    }
    return { ...blankState(), ...(JSON.parse(raw) as Partial<CommunityState>) }
  } catch {
    return blankState()
  }
}

function write(state: CommunityState): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage full or unavailable — non-fatal in the demo */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COMMUNITY_EVENT))
  }
}

/* A monotonic-ish id without Date dependency leaking into callers. */
function makeId(): string {
  return "edit-" + Math.random().toString(36).slice(2, 10)
}

/* ---------- Auth ---------- */

export function getCurrentUser(): CommunityUser | null {
  const { currentUserId } = read()
  return DEMO_USERS.find((u) => u.id === currentUserId) ?? null
}

export function signIn(userId: string): void {
  const state = read()
  write({ ...state, currentUserId: userId })
}

/** No real auth yet: every provider resolves to the same default identity. */
export function signInDefault(): void {
  signIn(DEMO_USERS[0].id)
}

export function signOut(): void {
  const state = read()
  write({ ...state, currentUserId: null })
}

/* ---------- Field helpers ---------- */

export function hasContent(fields: ContributorFields): boolean {
  return Boolean(fields.description.trim()) || fields.references.some((r) => r.label.trim() || r.url.trim())
}

export function changedKeys(fields: ContributorFields): ContributorFieldKey[] {
  const keys: ContributorFieldKey[] = []
  if (fields.description.trim()) keys.push("description")
  if (fields.references.some((r) => r.label.trim() || r.url.trim())) keys.push("references")
  return keys
}

/** Drop empty reference rows before persisting/displaying. */
export function cleanFields(fields: ContributorFields): ContributorFields {
  return {
    description: fields.description.trim(),
    references: fields.references
      .map((r) => ({ label: r.label.trim(), url: r.url.trim() }))
      .filter((r) => r.label || r.url),
  }
}

/* ---------- Drafts ---------- */

export function getDraft(deviceId: string): Draft | null {
  return read().drafts[deviceId] ?? null
}

export function getDraftFields(deviceId: string): ContributorFields {
  const draft = getDraft(deviceId)
  return draft ? draft.fields : { ...EMPTY_FIELDS, references: [] }
}

export function hasDraft(deviceId: string): boolean {
  const draft = getDraft(deviceId)
  return Boolean(draft && hasContent(draft.fields))
}

export function draftFieldCount(deviceId: string): number {
  const draft = getDraft(deviceId)
  return draft ? changedKeys(draft.fields).length : 0
}

export function saveDraft(device: DeviceRef, fields: ContributorFields): void {
  const state = read()
  const by = state.currentUserId ?? "anonymous"
  if (!hasContent(fields)) {
    // Nothing left to keep — remove the draft entirely.
    const { [device.id]: _removed, ...rest } = state.drafts
    write({ ...state, drafts: rest })
    return
  }
  const draft: Draft = {
    deviceId: device.id,
    deviceName: device.name,
    manufacturer: device.manufacturer,
    category: device.category,
    fields,
    updatedAt: new Date().toISOString(),
    by,
  }
  write({ ...state, drafts: { ...state.drafts, [device.id]: draft } })
}

export function clearDraft(deviceId: string): void {
  const state = read()
  if (!state.drafts[deviceId]) {
    return
  }
  const { [deviceId]: _removed, ...rest } = state.drafts
  write({ ...state, drafts: rest })
}

export function allDrafts(): Draft[] {
  return Object.values(read().drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/* ---------- Submissions ---------- */

export function getSubmissions(): Submission[] {
  return [...read().submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function submissionsForDevice(deviceId: string): Submission[] {
  return getSubmissions().filter((s) => s.deviceId === deviceId)
}

export function pendingCount(deviceId: string): number {
  return submissionsForDevice(deviceId).filter((s) => s.status === "pending").length
}

/** The published (live) overlay shown in the read view, newest live edit wins. */
export function liveFields(deviceId: string): ContributorFields | null {
  const live = submissionsForDevice(deviceId).find((s) => s.status === "live")
  return live ? live.fields : null
}

export function submitDraft(deviceId: string): Submission | null {
  const state = read()
  const draft = state.drafts[deviceId]
  if (!draft || !hasContent(draft.fields)) {
    return null
  }
  const fields = cleanFields(draft.fields)
  const submission: Submission = {
    id: makeId(),
    deviceId: draft.deviceId,
    deviceName: draft.deviceName,
    manufacturer: draft.manufacturer,
    category: draft.category,
    fields,
    changedKeys: changedKeys(fields),
    status: "pending",
    by: draft.by,
    submittedAt: new Date().toISOString(),
    prNumber: state.nextPr,
  }
  const { [deviceId]: _removed, ...restDrafts } = state.drafts
  write({
    ...state,
    drafts: restDrafts,
    submissions: [...state.submissions, submission],
    nextPr: state.nextPr + 1,
  })
  return submission
}

/** Demo-only: stand in for a GitHub reviewer merging or rejecting the PR. */
export function reviewSubmission(id: string, decision: "live" | "declined"): void {
  const state = read()
  write({
    ...state,
    submissions: state.submissions.map((s) => (s.id === id ? { ...s, status: decision } : s)),
  })
}

/* ---------- Subscription ---------- */

export function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }
  window.addEventListener(COMMUNITY_EVENT, listener)
  return () => window.removeEventListener(COMMUNITY_EVENT, listener)
}
