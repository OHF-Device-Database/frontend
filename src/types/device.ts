import { z } from "astro/zod";

export const MonoDevice = z.object({
  integration: z.string(),
  manufacturer: z.string(),
  count: z.number(),
  model: z.optional(z.string()),
  model_id: z.optional(z.string()),
});
export type MonoDevice = z.infer<typeof MonoDevice>;

export const PolyDevice = MonoDevice.extend({
  id: z.string(),
});
export type PolyDevice = z.infer<typeof PolyDevice>;
