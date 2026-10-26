import { AsyncLocalStorage } from "node:async_hooks";

import { featureRenderInstall } from "./feature";
import type { FeatureCookieJar } from "./feature";

export const scopeFeature: AsyncLocalStorage<FeatureCookieJar> =
	new AsyncLocalStorage();
featureRenderInstall(() => scopeFeature.getStore());
