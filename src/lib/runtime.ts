const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === `object` && input !== null;

type AbstractContent = {
  readonly sourceLocation: string;
  readonly collection: string;
  readonly slug: string;
  readonly locale: null | string;
  readonly props: Record<string, unknown>;
  readonly raw: null | string;
};

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

type AbstractFilter<Content extends AbstractContent> = DeepPartial<Content>;

const abstractMatchRaw = (filter: unknown, value: unknown): boolean => {
  if (typeof filter === `undefined`) {
    return true;
  }
  if (Array.isArray(filter)) {
    if (!Array.isArray(value)) {
      return false;
    }
    if (filter.length !== value.length) {
      return false;
    }
    for (let k = 0; k < filter.length; k++) {
      if (!abstractMatchRaw(filter[k], value[k])) {
        return false;
      }
    }
    return true;
  }
  if (isRecord(filter)) {
    if (!isRecord(value)) {
      return false;
    }
    for (const key of Object.keys(filter)) {
      if (!abstractMatchRaw(filter[key], value[key])) {
        return false;
      }
    }
    return true;
  }
  return filter === value;
};

const abstractMatch =
  <Content extends AbstractContent, Filter extends AbstractFilter<Content>>(
    filter: Filter,
  ) =>
  (content: Content): content is Extract<Content, Filter> =>
    abstractMatchRaw(filter, content);

type Match<Content extends AbstractContent> = <
  Filter extends AbstractFilter<Content>,
>(
  filter: Filter,
) => (content: Content) => content is Extract<Content, Filter>;

type FindAllContents<Content extends AbstractContent> = <
  Filter extends AbstractFilter<Content>,
>(
  filter: Filter,
) => Extract<Content, Filter>[];

type FindUniqueContent<Content extends AbstractContent> = <
  Filter extends AbstractFilter<Content>,
>(
  filter: Filter,
) => Extract<Content, Filter>;

type Runtime<Content extends AbstractContent> = {
  readonly findAll: FindAllContents<Content>;
  readonly findUnique: FindUniqueContent<Content>;
  readonly match: Match<Content>;
};

const createAbstractRuntime = <Content extends AbstractContent>(
  contents: readonly Content[],
): Runtime<Content> => {
  const findAll: FindAllContents<Content> = <
    Filter extends AbstractFilter<Content>,
  >(
    filter: Filter,
  ) => {
    const matchFilter = abstractMatch<Content, Filter>(filter);
    return contents.filter(matchFilter);
  };

  const findUnique: FindUniqueContent<Content> = <
    Filter extends AbstractFilter<Content>,
  >(
    filter: Filter,
  ) => {
    const allContents = findAll(filter);
    if (allContents.length === 0) {
      throw new Error(`Content not found`);
    }
    if (allContents.length > 1) {
      throw new Error(`Multiple contents found`);
    }
    return allContents[0];
  };

  return {
    findAll,
    findUnique,
    match: abstractMatch,
  };
};

export { createAbstractRuntime };
