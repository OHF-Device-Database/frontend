import { describe, expect, it } from "vitest";

import { extractCategories, rank } from "../src/utilities/search";

const manufacturers = [
	{ name: "Samsung Electronics", count: 1510 },
	{ name: "Samjin", count: 7 },
	{ name: "AirBeamTV", count: 1 },
	{ name: "Xiaomi", count: 140 },
	{ name: "Aqara", count: 50 },
	{ name: "Xiaomi Aqara", count: 28 },
	{ name: "BSH Hausgeräte", count: 1 },
];
const names = (term: string) =>
	rank(manufacturers, term, ({ name }) => name).map(({ name }) => name);

const categories = [
	{ id: "lighting", label: "Lighting" },
	{ id: "printing", label: "Printing" },
	{ id: "cleaning", label: "Cleaning" },
	{ id: "climate-control", label: "Climate control" },
	{ id: "security-and-access-control", label: "Security and access control" },
	{ id: "pool-and-spa", label: "Pool and spa" },
	{ id: "weather", label: "Weather" },
	{ id: "water-management", label: "Water management" },
	{ id: "networking", label: "Networking" },
	{ id: "monitoring", label: "Monitoring" },
	{ id: "power-and-energy", label: "Power and energy" },
];
const extract = (term: string) => {
	const result = extractCategories(term, categories);
	return { term: result.term, category: [...result.category] };
};

describe("rank", () => {
	it("keeps everything, sorted by count, for an empty term", () => {
		expect(names(" ")).toEqual(
			manufacturers
				.toSorted((a, b) => b.count - a.count)
				.map(({ name }) => name),
		);
	});

	it("prefers count among equally good matches", () => {
		expect(names("sam")[0]).toBe("Samsung Electronics");
	});

	it("tolerates unrelated words, word order, typos and accents", () => {
		expect(names("samsung tv")[0]).toBe("Samsung Electronics");
		expect(names("electronics samsung")[0]).toBe("Samsung Electronics");
		expect(names("aqara xiaomi")[0]).toBe("Xiaomi Aqara");
		expect(names("xiomi")[0]).toBe("Xiaomi");
		expect(names("hausgerate")).toEqual(["BSH Hausgeräte"]);
	});

	it("finds single letters", () => {
		expect(names("x")[0]).toBe("Xiaomi");
	});

	it("drops items matching no word", () => {
		expect(names("zzzz")).toEqual([]);
	});
});

describe("extractCategories", () => {
	it("moves (partial, misspelled) category names out of the term", () => {
		expect(extract("hue lighting")).toEqual({
			term: "hue",
			category: ["lighting"],
		});
		expect(extract("philips hue light")).toEqual({
			term: "philips hue",
			category: ["lighting"],
		});
		expect(extract("ligthing")).toEqual({ term: "", category: ["lighting"] });
		expect(extract("print brother")).toEqual({
			term: "brother",
			category: ["printing"],
		});
	});

	it("drops ambiguous words belonging to an extracted category", () => {
		expect(extract("climate control")).toEqual({
			term: "",
			category: ["climate-control"],
		});
	});

	it("lets an exact word win over fuzzy alternatives", () => {
		expect(extract("weather station")).toEqual({
			term: "station",
			category: ["weather"],
		});
	});

	it("does not mistake manufacturer names for categories", () => {
		for (const name of ["Nest Labs", "Flo by Moen", "MINI", "Slim Devices"]) {
			expect(extract(name).category).toEqual([]);
		}
	});

	it("leaves ambiguous, short and mid-word matches alone", () => {
		expect(extract("cont")).toEqual({ term: "cont", category: [] });
		expect(extract("and")).toEqual({ term: "and", category: [] });
		expect(extract("leak detector")).toEqual({
			term: "leak detector",
			category: [],
		});
		expect(extract("powerview hub")).toEqual({
			term: "powerview hub",
			category: [],
		});
		expect(extract("tp-link")).toEqual({ term: "tp-link", category: [] });
	});
});
