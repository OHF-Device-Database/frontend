import { z } from "astro/zod";

import sample from "./mock/contributors.json";

export const IoContributor = z.object({
	name: z.string().min(1),
	/** free text, in the contributor's own words */
	location: z.optional(z.string().min(1)),
	/** image of the contributor */
	avatar: z.optional(z.httpUrl()),
	/** the contributor's own page, which their row leads to */
	url: z.optional(z.httpUrl()),
	contributions: z.int().nonnegative(),
});
export type IoContributor = z.infer<typeof IoContributor>;

export const IoContributors = z.array(IoContributor);

// there is no endpoint yet, so the directory stays empty until there is one
export const getContributors = (): Promise<{
	contributors: IoContributor[];
}> => Promise.resolve({ contributors: [] });

/** made-up people, to look at the directory with rows in it until then */
export const getContributorsSample = (): Promise<{
	contributors: IoContributor[];
}> => Promise.resolve({ contributors: IoContributors.parse(sample) });
