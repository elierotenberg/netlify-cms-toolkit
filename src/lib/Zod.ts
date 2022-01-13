import { ZodSchema } from "zod";

export function assertZod<T>(
  schema: ZodSchema<T>,
  input: unknown,
): asserts input is T {
  schema.parse(input);
}
