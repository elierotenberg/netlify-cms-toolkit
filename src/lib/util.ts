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
