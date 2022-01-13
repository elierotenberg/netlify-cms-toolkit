import { z, ZodSchema } from "zod";

const SerializablePrimitive = z.union(
  [
    z.string({ invalid_type_error: `SerializablePrimitiveString` }),
    z.number({ invalid_type_error: `SerializablePrimitiveNumber` }),
    z.boolean({ invalid_type_error: `SerializablePrimitiveBoolean` }),
    z.null({ invalid_type_error: `SerializablePrimitiveNull` }),
    z.undefined({ invalid_type_error: `SerializablePrimitiveUndefined` }),
    z.date({ invalid_type_error: `SerializablePrimitiveDate` }),
  ],
  { invalid_type_error: `SerializablePrimitiveUnion` },
);

export type SerializablePrimitive = z.infer<typeof SerializablePrimitive>;

export type SerializableRecord = { readonly [key: string]: Serializable };

export type SerializableArray = Serializable[];

export type Serializable =
  | SerializablePrimitive
  | SerializableRecord
  | SerializableArray;

export const SerializableRecord: ZodSchema<SerializableRecord> = z.lazy(
  () => z.record(Serializable, { invalid_type_error: `SerializableRecord` }),
  {
    invalid_type_error: `SerializableRecordLazy`,
  },
);

export const SerializableArray: ZodSchema<SerializableArray> = z.lazy(
  () => z.array(Serializable, { invalid_type_error: `SerializableArray` }),
  { invalid_type_error: `SerializableArrayLazy` },
);

export const Serializable: ZodSchema<Serializable> = z.lazy(
  () =>
    z.union([SerializablePrimitive, SerializableRecord, SerializableArray], {
      invalid_type_error: `SerializableUnion`,
    }),
  {
    invalid_type_error: `Serializable`,
  },
);
