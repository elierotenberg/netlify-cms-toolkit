import { z } from "zod";

const FieldI18n = z.union([z.literal(true), z.literal(`duplicate`)]);

const BaseField = z.object({
  name: z.string(),
  i18n: FieldI18n.optional(),
});

type BaseField = z.infer<typeof BaseField>;

const SimpleField = BaseField.extend({
  widget: z.union([
    z.literal(`boolean`),
    z.literal(`code`),
    z.literal(`color`),
    z.literal(`date`),
    z.literal(`datetime`),
    z.literal(`file`),
    z.literal(`hidden`),
    z.literal(`image`),
    z.literal(`map`),
    z.literal(`markdown`),
    z.literal(`number`),
    z.literal(`relation`),
    z.literal(`select`),
    z.literal(`string`),
    z.literal(`text`),
  ]),
});

type SimpleField = z.infer<typeof SimpleField>;

export type ObjectField = BaseField & {
  readonly widget: `object`;
  readonly fields: Field[];
};

const ObjectField: z.ZodSchema<ObjectField> = z.lazy(() =>
  BaseField.extend({
    widget: z.literal(`object`),
    fields: z.array(Field),
  }),
);

type ListField = BaseField & {
  readonly widget: `list`;
  readonly field?: Field;
  readonly fields?: Field[];
};

const ListField: z.ZodSchema<ListField> = z.lazy(() =>
  BaseField.extend({
    widget: z.literal(`list`),
    fields: z.array(Field).optional(),
    field: Field.optional(),
  }),
);

const CompositeField = z.union([ObjectField, ListField]);
type CompositeField = z.infer<typeof CompositeField>;

export const Field = z.union([SimpleField, CompositeField]);

export type Field = z.infer<typeof Field>;

export const isCompositeField = (field: Field): field is CompositeField => {
  try {
    CompositeField.parse(field);
    return true;
  } catch {
    return false;
  }
};

const Fields = z.array(Field);

const SingleFileI18nStructure = z.literal(`single_file`);
const MultipleFilesI18nStructure = z.literal(`multiple_files`);
const MultipleFoldersI18nStructure = z.literal(`multiple_folders`);

const GlobalI18nStructure = z.union([
  SingleFileI18nStructure,
  MultipleFilesI18nStructure,
  MultipleFoldersI18nStructure,
]);

const FolderCollectionI18nStructure = z.union([
  SingleFileI18nStructure,
  MultipleFilesI18nStructure,
  MultipleFoldersI18nStructure,
]);

export type FolderCollectionI18nStructure = z.infer<
  typeof FolderCollectionI18nStructure
>;

export const FolderCollectionI18n = z.union([
  z.literal(true),
  z.object({
    structure: FolderCollectionI18nStructure,
  }),
]);

const FilesCollectionI18nStructure = SingleFileI18nStructure;

export type FilesCollectionI18nStructure = z.infer<
  typeof FilesCollectionI18nStructure
>;

export const FilesCollectionI18n = z.union([
  z.literal(true),
  z.object({
    structure: FilesCollectionI18nStructure,
  }),
]);

const FolderCollection = z.object({
  name: z.string(),
  i18n: FolderCollectionI18n.optional(),
  folder: z.string(),
  fields: Fields,
});

export type FolderCollection = z.infer<typeof FolderCollection>;

const FilesCollectionItem = z.object({
  name: z.string(),
  file: z.string(),
  i18n: z.boolean().optional(),
  fields: Fields,
});

export type FilesCollectionItem = z.infer<typeof FilesCollectionItem>;

const FilesCollection = z.object({
  name: z.string(),
  i18n: FilesCollectionI18n.optional(),
  files: z.array(FilesCollectionItem),
});

export type FilesCollection = z.infer<typeof FilesCollection>;

const Collection = z.union([FolderCollection, FilesCollection]);

export type Collection = z.infer<typeof Collection>;

const FolderTaggedCollection = FolderCollection.extend({
  kind: z.literal(`folder`),
});

export type FolderTaggedCollection = z.infer<typeof FolderTaggedCollection>;

const FilesTaggedCollection = FilesCollection.extend({
  kind: z.literal(`files`),
});
export type FilesTaggedCollection = z.infer<typeof FilesTaggedCollection>;

export const TaggedCollection = z.union([
  FolderTaggedCollection,
  FilesTaggedCollection,
]);

export type TaggedCollection = z.infer<typeof TaggedCollection>;

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

export const matchCollection = <FoldersResult, FilesResult>(
  collection: TaggedCollection,
  match: {
    readonly folder: (collection: FolderTaggedCollection) => FoldersResult;
    readonly files: (collection: FilesTaggedCollection) => FilesResult;
  },
): FoldersResult | FilesResult =>
  collection.kind === `folder`
    ? match.folder(collection)
    : match.files(collection);

export const Schema = z.object({
  i18n: z
    .object({
      structure: GlobalI18nStructure,
      locales: z.array(z.string()),
    })
    .optional(),
  locale: z.string().optional(),
  collections: z.array(Collection),
});

export type Schema = z.infer<typeof Schema>;
