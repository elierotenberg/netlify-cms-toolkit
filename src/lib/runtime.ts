type AbstractContent = {
  readonly collection: string;
  readonly location: string;
  readonly slug: string;
  readonly locale: null | string;
  readonly raw: null | string;
  readonly data: Record<string, unknown>;
};

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

type AbstractFilter<Content extends AbstractContent> = Partial<
  Omit<Content, `data`> & {
    readonly data: Partial<Content[`data`]>;
  }
> &
  DeepPartial<Content>;

const match = <
  Content extends AbstractContent,
  Filter extends AbstractFilter<Content>,
>(
  filter: Filter,
  content: Content,
): content is Extract<Content, Filter> => {
  for (const key of [
    `collection`,
    `location`,
    `slug`,
    `locale`,
    `raw`,
  ] as const) {
    if (typeof filter[key] !== `undefined`) {
      if (content[key] !== filter[key]) {
        return false;
      }
    }
  }
  if (typeof filter[`data`] !== `undefined`) {
    for (const key of Object.keys(filter[`data`])) {
      if (typeof filter.data[key] !== `undefined`) {
        if (filter.data[key] !== content.data[key]) {
          return false;
        }
      }
    }
  }
  return true;
};

type Match<Content extends AbstractContent> = <
  Filter extends AbstractFilter<Content>,
>(
  filter: Filter,
  content: Content,
) => content is Extract<Content, Filter>;

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

export const createRuntime = <Content extends AbstractContent>(
  contents: readonly Content[],
): Runtime<Content> => {
  const findAll: FindAllContents<Content> = <
    Filter extends AbstractFilter<Content>,
  >(
    filter: Filter,
  ) =>
    contents.reduce((contents, content) => {
      if (match(filter, content)) {
        return [...contents, content];
      }
      return contents;
    }, [] as Extract<Content, Filter>[]);

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
    match,
  };
};

export type CreateFilter<Content extends AbstractContent> =
  AbstractFilter<Content>;
