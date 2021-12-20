import { z } from "zod";

export const Content = z.object({
  collection: z.string(),
  location: z.string(),
  slug: z.string(),
  locale: z.string().optional(),
  data: z.record(z.unknown()),
  raw: z.string().optional(),
});

export type Content = z.infer<typeof Content>;
