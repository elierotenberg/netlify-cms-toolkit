import { expectType, expectNotType } from "tsd";

import { locales, Schema } from "./fixtures/out.test/assets";
import { contents, defaultLocale } from "./fixtures/out/assets";

describe(`Runtime`, () => {
  test(`Types`, () => {
    type Guide = Schema[`collection`][`guides`];
    type GuideSlug = Guide[`slug`];

    expectType<GuideSlug>(`about-animals`);
    expectNotType<GuideSlug>(`about-robots`);

    const siteName = contents.translations.site.find(
      (site) => site.locale === `en`,
    )?.props.name;

    expectType<string | undefined>(siteName);

    expectType<readonly (`en` | `fr` | `pt`)[]>(locales);
    expectType<`en` | `fr` | `pt`>(defaultLocale);
    expect(defaultLocale).toEqual(`en`);
  });
});
