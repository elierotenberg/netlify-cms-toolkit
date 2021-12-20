import { createRuntime } from "../lib/runtime";

import { contents } from "./fixtures/static";

describe(`runtime`, () => {
  test(`findAll, findUnique`, () => {
    const { findAll, findUnique } = createRuntime(contents);

    expect(findAll({ locale: `en` })).toEqual(
      contents.filter((content) => content.locale === `en`),
    );

    expect(findAll({ slug: `home` })).toEqual(
      contents.filter((content) => content.slug === `home`),
    );

    expect(
      findAll({
        locale: `en`,
        collection: `multiple_folders_folder_collection`,
        slug: `multiple-files-folder-collection-item-1`,
      } as never),
    ).toEqual([]);

    expect(
      findUnique({
        collection: `multiple_folders_folder_collection`,
        locale: `en`,
        slug: `multiple-folders-folder-collection-item-1`,
      }),
    ).toEqual(
      contents.find(
        (content) =>
          content.collection === `multiple_folders_folder_collection` &&
          content.locale === `en` &&
          content.slug === `multiple-folders-folder-collection-item-1`,
      ),
    );

    expect(() =>
      findUnique({
        locale: `en`,
        collection: `multiple_folders_folder_collection`,
        slug: `multiple-files-folder-collection-item-1`,
      } as never),
    ).toThrow();
  });
});

export {};
