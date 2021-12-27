import * as changeCase from "change-case";
import { z } from "zod";

export const isNotNull = <T>(input: T): input is Exclude<T, null> =>
  input !== null;

export const mapAsync = async <T, U>(
  items: T[],
  fn: (item: T) => Promise<U>,
): Promise<U[]> => {
  const settledResults = await Promise.allSettled(items.map(fn));
  const results: U[] = [];
  const errors: unknown[] = [];

  for (const settledResult of settledResults) {
    if (settledResult.status === `rejected`) {
      console.error(settledResult.reason);
      errors.push(settledResult.reason);
    } else {
      results.push(settledResult.value);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  return results;
};

export const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === `object` && input !== null;

export const casings = [
  `preserve`,
  `camelCase`,
  `pascalCase`,
  `snakeCase`,
] as const;

export const Casing = z.enum(casings);

export type Casing = z.infer<typeof Casing>;

export const applyCasing = (casing: Casing, input: string): string => {
  switch (casing) {
    case `camelCase`:
      return changeCase.camelCase(input);
    case `pascalCase`:
      return changeCase.pascalCase(input);
    case `snakeCase`:
      return changeCase.snakeCase(input);
    default:
      return input;
  }
};
