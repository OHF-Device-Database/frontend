import { getGlobalDispatcher, interceptors, setGlobalDispatcher } from "undici";

// node.js adapter http fetch setup: cache responses, fold concurrent identical requests into one
setGlobalDispatcher(
	getGlobalDispatcher().compose(
		interceptors.deduplicate(),
		interceptors.cache({}),
	),
);
