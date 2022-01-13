import { z } from "zod";

const FieldI18n = z.union([z.literal(true), z.literal(`duplicate`)]);

const BaseField = z.object({
  name: z.string(),
  i18n: FieldI18n.optional(),
  required: z.boolean().optional(),
});

type BaseField = z.infer<typeof BaseField>;

export const BooleanField = BaseField.extend({
  widget: z.literal(`boolean`),
});
export type BooleanField = z.infer<typeof BooleanField>;

export const CodeField = BaseField.extend({
  widget: z.literal(`code`),
});
export type CodeField = z.infer<typeof CodeField>;

export const ColorField = BaseField.extend({
  widget: z.literal(`color`),
});
export type ColorField = z.infer<typeof ColorField>;

export const DateTimeField = BaseField.extend({
  widget: z.literal(`datetime`),
});
export type DateTimeField = z.infer<typeof DateTimeField>;

export const FileField = BaseField.extend({
  widget: z.literal(`file`),
  allow_multiple: z.boolean().optional(),
});
export type FileField = z.infer<typeof FileField>;

const HiddenField = BaseField.extend({
  widget: z.literal(`hidden`),
});
export type HiddenField = z.infer<typeof HiddenField>;

const ImageField = BaseField.extend({
  widget: z.literal(`image`),
});
export type ImageField = z.infer<typeof ImageField>;

export type ListField = BaseField & {
  readonly widget: `list`;
  readonly field?: Field;
  readonly fields?: Field[];
  readonly allow_add?: boolean;
  readonly min?: number;
  readonly max?: number;
};
export const ListField: z.ZodSchema<ListField> = z.lazy(() =>
  BaseField.extend({
    widget: z.literal(`list`),
    field: Field.optional(),
    fields: z.array(Field).optional(),
    allow_add: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
);

export const MapField = BaseField.extend({
  widget: z.literal(`map`),
});
export type MapField = z.infer<typeof MapField>;

export const MarkdownField = BaseField.extend({
  widget: z.literal(`markdown`),
});
export type MarkdownField = z.infer<typeof MarkdownField>;

export const NumberField = BaseField.extend({
  widget: z.literal(`number`),
  value_type: z.union([z.literal(`int`), z.literal(`float`)]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type NumberField = z.infer<typeof NumberField>;

export type ObjectField = BaseField & {
  readonly widget: `object`;
  readonly fields: Field[];
};
export const ObjectField: z.ZodSchema<ObjectField> = z.lazy(() =>
  BaseField.extend({
    widget: z.literal(`object`),
    fields: z.array(Field),
  }),
);

const RelationField = BaseField.extend({
  widget: z.literal(`relation`),
  multiple: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type RelationField = z.infer<typeof RelationField>;

export const SelectFieldOption = z.union([
  z.string(),
  z.object({
    label: z.string(),
    value: z.string(),
  }),
]);

export type SelectFieldOption = z.infer<typeof SelectFieldOption>;

export const SelectField = BaseField.extend({
  widget: z.literal(`select`),
  options: z.array(SelectFieldOption).min(1),
  multiple: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type SelectField = z.infer<typeof SelectField>;

export const StringField = BaseField.extend({
  widget: z.literal(`string`),
});
export type StringField = z.infer<typeof StringField>;

export const TextField = BaseField.extend({
  widget: z.literal(`text`),
});
export type TextField = z.infer<typeof TextField>;

export const Field = z.union([
  BooleanField,
  CodeField,
  ColorField,
  DateTimeField,
  FileField,
  HiddenField,
  ImageField,
  ListField,
  MapField,
  MarkdownField,
  NumberField,
  ObjectField,
  RelationField,
  SelectField,
  StringField,
  TextField,
]);
export type Field = z.infer<typeof Field>;

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
export type FolderCollectionI18n = z.infer<typeof FolderCollectionI18n>;

const FilesCollectionI18nStructure = SingleFileI18nStructure;

export type FilesCollectionI18nStructure = z.infer<
  typeof FilesCollectionI18nStructure
>;

export const FilesCollectionI18n = z.union([
  z.boolean(),
  z.object({
    structure: FilesCollectionI18nStructure,
  }),
]);
export type FilesCollectionI18n = z.infer<typeof FilesCollectionI18n>;

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

export const FolderTaggedCollection = FolderCollection.extend({
  kind: z.literal(`folder`),
});

export type FolderTaggedCollection = z.infer<typeof FolderTaggedCollection>;

export const FilesTaggedCollection = FilesCollection.extend({
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
