import { createServer } from "node:http";

import { afterAll, beforeAll, test } from "vitest";
import type { AddressInfo } from "node:net";

import "../src/io/http-cache.ts";

let hits = 0;
const server = createServer((_req, res) => {
	hits++;
	// `no-store` keeps the cache interceptor out of the picture, isolating deduplication
	setTimeout(() => res.setHeader("cache-control", "no-store").end("ok"), 50);
});

let url: string;
beforeAll(async () => {
	await new Promise<void>((resolve) => server.listen(0, resolve));
	url = `http://localhost:${(server.address() as AddressInfo).port}/`;
});
afterAll(() => server.close());

test("concurrent identical requests are folded into one", async (t) => {
	hits = 0;
	const bodies = await Promise.all(
		[1, 2, 3].map(() => fetch(url).then((res) => res.text())),
	);
	t.expect(bodies).toEqual(["ok", "ok", "ok"]);
	t.expect(hits).toBe(1);
});

test("sequential requests are not folded", async (t) => {
	hits = 0;
	await fetch(url).then((res) => res.text());
	await fetch(url).then((res) => res.text());
	t.expect(hits).toBe(2);
});
