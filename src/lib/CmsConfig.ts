import { z } from "zod";

const I18nStructure = z.union([
  z.literal(`multiple_files`),
  z.literal(`multiple_folders`),
  z.literal(`single_file`),
]);

export type I18nStructure = z.infer<typeof I18nStructure>;

const GlobalI18n = z.object({
  structure: I18nStructure,
  locales: z.array(z.string()),
});

const I18nOption = z
  .union([
    z.literal(true),
    z.object({
      structure: I18nStructure,
    }),
  ])
  .optional();

const CollectionField = z.object({
  name: z.string(),
  i18n: z.union([z.literal(true), z.literal(`duplicate`)]).optional(),
});

const CollectionFields = z.array(CollectionField);

const FolderCollection = z.object({
  name: z.string(),
  i18n: I18nOption,
  folder: z.string(),
  fields: CollectionFields,
});

export type FolderCollection = z.infer<typeof FolderCollection>;

const CollectionFile = z.object({
  name: z.string(),
  file: z.string(),
  i18n: I18nOption,
  fields: CollectionFields,
});

export type CollectionFile = z.infer<typeof CollectionFile>;

const FilesCollection = z.object({
  name: z.string(),
  i18n: I18nOption,
  files: z.array(CollectionFile),
});

export type FilesCollection = z.infer<typeof FilesCollection>;

const Collection = z.union([FolderCollection, FilesCollection]);

export type Collection = z.infer<typeof Collection>;

export type TaggedCollection =
  | ({ readonly kind: `folder` } & FolderCollection)
  | ({ readonly kind: `files` } & FilesCollection);

export const tagCollection = (collection: Collection): TaggedCollection => {
  try {
    return {
      kind: `folder`,
      ...FolderCollection.parse(collection),
    };
  } catch {
    try {
      return {
        kind: `files`,
        ...FilesCollection.parse(collection),
      };
    } catch {
      throw new Error(`Invalid collection: ${collection.name}`);
    }
  }
};

export const getCollectionI8nStructure = (
  cmsConfig: CmsConfig,
  collection: Collection,
): I18nStructure | undefined => {
  if (!collection.i18n) {
    return undefined;
  }
  if (collection.i18n === true) {
    return cmsConfig.i18n?.structure;
  }
  return collection.i18n.structure;
};

export const CmsConfig = z.object({
  i18n: GlobalI18n.optional(),
  collections: z.array(Collection),
});

export type CmsConfig = z.infer<typeof CmsConfig>;
