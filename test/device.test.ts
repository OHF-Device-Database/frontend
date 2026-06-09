import { describe, expect, it } from "vitest";
import { Device, requiresInternet } from "../src/lib/device";
import { MOCK_DEVICES } from "../src/lib/mock-devices";

describe("device schema", () => {
    it("parses every mock device", () => {
        for (const device of MOCK_DEVICES) {
            expect(() => Device.parse(device)).not.toThrow();
        }
    });

    it("rejects an invalid local control value", () => {
        expect(() => Device.parse({ ...MOCK_DEVICES[0], local: "maybe" })).toThrow();
    });
});

describe("requiresInternet", () => {
    it("is false for fully local, non-cloud-required devices", () => {
        expect(requiresInternet({ ...MOCK_DEVICES[0], local: "always", cloud: "none" })).toBe(false);
        expect(requiresInternet({ ...MOCK_DEVICES[0], local: "always", cloud: "optional" })).toBe(
            false,
        );
    });

    it("is true when local control is not always", () => {
        expect(requiresInternet({ ...MOCK_DEVICES[0], local: "sometimes", cloud: "none" })).toBe(
            true,
        );
    });

    it("is true when the cloud is required even if local", () => {
        expect(requiresInternet({ ...MOCK_DEVICES[0], local: "always", cloud: "required" })).toBe(
            true,
        );
    });
});
