import { beforeEach, describe, expect, it } from "vitest";

// The community store is client-only (localStorage + window events). Shim both
// before importing so the module's runtime guards see a real environment.
const store = new Map<string, string>();
globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
} as Storage;
globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;

const {
    DEMO_USERS,
    getCurrentUser,
    signIn,
    signOut,
    saveDraft,
    getDraft,
    hasDraft,
    submitDraft,
    reviewSubmission,
    liveFields,
    pendingCount,
    submissionsForDevice,
} = await import("../src/lib/community");

const DEVICE = { id: "dev-1", name: "Test Bulb", manufacturer: "Acme", category: "lighting" };

describe("community store lifecycle", () => {
    beforeEach(() => store.clear());

    it("signs in and out", () => {
        expect(getCurrentUser()).toBeNull();
        signIn(DEMO_USERS[0].id);
        expect(getCurrentUser()?.id).toBe(DEMO_USERS[0].id);
        signOut();
        expect(getCurrentUser()).toBeNull();
    });

    it("autosaves and clears empty drafts", () => {
        signIn(DEMO_USERS[0].id);
        saveDraft(DEVICE, { description: "", references: [] });
        expect(hasDraft(DEVICE.id)).toBe(false);
        saveDraft(DEVICE, { description: "A local Zigbee bulb.", references: [] });
        expect(hasDraft(DEVICE.id)).toBe(true);
        expect(getDraft(DEVICE.id)?.by).toBe(DEMO_USERS[0].id);
    });

    it("runs the full draft -> submit -> review -> live lifecycle", () => {
        signIn(DEMO_USERS[0].id);
        saveDraft(DEVICE, {
            description: "A local Zigbee bulb.",
            references: [{ label: "Docs", url: "https://example.com" }],
        });

        const submission = submitDraft(DEVICE.id);
        expect(submission).not.toBeNull();
        expect(submission!.status).toBe("pending");
        expect(submission!.changedKeys.sort()).toEqual(["description", "references"]);
        // Submitting clears the draft and does not publish yet.
        expect(hasDraft(DEVICE.id)).toBe(false);
        expect(pendingCount(DEVICE.id)).toBe(1);
        expect(liveFields(DEVICE.id)).toBeNull();

        reviewSubmission(submission!.id, "live");
        expect(pendingCount(DEVICE.id)).toBe(0);
        expect(liveFields(DEVICE.id)?.description).toBe("A local Zigbee bulb.");
    });

    it("declines without publishing", () => {
        signIn(DEMO_USERS[1].id);
        saveDraft(DEVICE, { description: "Cloud-only.", references: [] });
        const submission = submitDraft(DEVICE.id);
        reviewSubmission(submission!.id, "declined");
        expect(liveFields(DEVICE.id)).toBeNull();
        expect(submissionsForDevice(DEVICE.id)[0].status).toBe("declined");
    });

    it("strips empty reference rows on submit", () => {
        signIn(DEMO_USERS[0].id);
        saveDraft(DEVICE, {
            description: "x",
            references: [
                { label: "Keep", url: "https://keep.example" },
                { label: "", url: "" },
            ],
        });
        const submission = submitDraft(DEVICE.id);
        expect(submission!.fields.references).toHaveLength(1);
    });
});
