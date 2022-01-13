export const findStrict = <T>(t: T[], predicate: (t: T) => boolean): T => {
  const item = t.find((item) => predicate(item));
  if (typeof item === `undefined`) {
    throw new Error(`Item not found`);
  }
  return item;
};

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

export const memoize = <K extends Record<string, unknown>, V>(
  fn: (k: K) => V,
): ((k: K) => V) => {
  const t = new Map<K, V>();
  return (k) => {
    if (t.has(k)) {
      return t.get(k) as V;
    }
    const v = fn(k);
    t.set(k, v);
    return v;
  };
};

export const isNotNull = <T>(input: T | null): input is Exclude<T, null> =>
  input !== null;

export const deduplicate = <T>(t: T[]): T[] =>
  t.reduce<T[]>((t, item) => (t.includes(item) ? t : [...t, item]), []);
