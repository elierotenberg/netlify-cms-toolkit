import { expectType } from "tsd";

import { Content, contents, findAll, findUnique } from "./fixtures/out";

describe(`runtime`, () => {
  test(`findAll, findUnique`, () => {
    expect(findAll({ locale: `en` })).toEqual(
      contents.filter((content) => content.locale === `en`),
    );

    const animals = findAll({ slug: `about-animals` });

    expect(animals).toEqual(
      contents.filter((content) => content.slug === `about-animals`),
    );

    expectType<Extract<Content, { slug: `about-animals` }>[]>(animals);

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
