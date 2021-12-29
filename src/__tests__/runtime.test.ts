import { expectType } from "tsd";

import { Content, contents, findAll, findUnique, match } from "./fixtures/out";

describe(`runtime`, () => {
  test(`findAll, findUnique`, () => {
    expect(findAll({ locale: `en` })).toEqual(
      contents.filter((content) => content.locale === `en`),
    );

    expect(findAll({ slug: `about-animals` })).toEqual(
      contents.filter((content) => content.slug === `about-animals`),
    );

    const matchGuideTag = match({ collection: `guideTags` });

    expectType<
      (
        content: Content,
      ) => content is Extract<Content, { collection: `guideTags` }>
    >(matchGuideTag);

    type Guide = Extract<Content, { collection: `guides` }>;

    const getGuideTitle = <G extends Guide>(guide: G): G[`props`][`title`] =>
      guide.props.title;

    const title = getGuideTitle(
      findUnique({
        collection: `guides`,
        locale: `en`,
        slug: `about-animals-and-plants`,
      }),
    );

    expectType<`About animals and plants`>(title);
    expect(title).toEqual(`About animals and plants`);
  });
});

export {};
