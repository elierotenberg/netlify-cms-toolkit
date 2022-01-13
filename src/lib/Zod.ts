import { ZodSchema } from "zod";

export const isZod =
  <T>(Schema: ZodSchema<T>) =>
  (input: unknown): input is T => {
    try {
      Schema.parse(input);
      return true;
    } catch {
      return false;
    }
  };

export function assertZod<T>(
  schema: ZodSchema<T>,
  input: unknown,
): asserts input is T {
  schema.parse(input);
}
