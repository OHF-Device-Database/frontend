import {
	FEATURE_PARAM,
	featureDatasetApply,
	featureParamEnabled,
	featuresSet,
} from "../utilities/feature.js";

/** sources and removes enablement overrides from url and adds `<html data-feature-*>` for prerendered pages */
const apply = (): void => {
	const url = new URL(window.location.href);
	const override = featureParamEnabled(url.searchParams);
	if (typeof override !== "undefined") {
		featuresSet(override);

		// removes enablement overrides
		url.searchParams.delete(FEATURE_PARAM);
		window.history.replaceState(window.history.state, "", url);
		return;
	}

	featureDatasetApply();
};

apply();

document.addEventListener("astro:after-swap", apply);
