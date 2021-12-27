import { z } from "zod";

type JsonPrimitive = string | number | boolean | null;
export type Json = JsonPrimitive | { readonly [key: string]: Json } | Json[];

export const Json: z.ZodSchema<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(Json),
    z.record(Json),
  ]),
);
