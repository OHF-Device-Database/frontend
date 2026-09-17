import { getGlobalDispatcher, interceptors, setGlobalDispatcher } from "undici";

// node.js adapter caching http fetch setup
setGlobalDispatcher(getGlobalDispatcher().compose(interceptors.cache({})));
