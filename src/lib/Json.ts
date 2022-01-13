import { z } from "zod";

const JsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type JsonPrimitive = z.infer<typeof JsonPrimitive>;
export type Json = JsonPrimitive | { readonly [key: string]: Json } | Json[];

export const Json: z.ZodSchema<Json> = z.lazy(() =>
  z.union([JsonPrimitive, z.array(Json), z.record(Json)]),
);

export const JsonRecord = z.record(Json);
export type JsonRecord = z.infer<typeof JsonRecord>;

const JsonOrDatePrimitive = z.union([JsonPrimitive, z.date(), z.undefined()]);
type JsonOrDatePrimitive = z.infer<typeof JsonOrDatePrimitive>;

export type JsonOrDate =
  | JsonOrDatePrimitive
  | { readonly [key: string]: JsonOrDate }
  | JsonOrDate[];

export const JsonOrDate: z.ZodSchema<JsonOrDate> = z.lazy(() =>
  z.union([
    JsonOrDatePrimitive,
    z.array(JsonOrDatePrimitive),
    z.record(JsonOrDatePrimitive),
  ]),
);
