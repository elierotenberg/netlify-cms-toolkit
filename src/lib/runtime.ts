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

const matchFilter = <
  Content extends AbstractContent,
  Filter extends AbstractFilter<Content>,
>(
  content: Content,
  filter: Filter,
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
      if (matchFilter(content, filter)) {
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
  };
};
