import { parse as parsePath, sep, ParsedPath, resolve, relative } from "path";
import { readFile } from "fs/promises";
import { inspect } from "util";

import parseMatter from "gray-matter";
import { load } from "js-yaml";
import globby from "globby";
import { z } from "zod";

import { isNotNull, mapAsync } from "./util";
import {
  FilesCollectionI18nStructure,
  FilesCollectionItem,
  FilesTaggedCollection,
  FolderCollectionI18nStructure,
  FolderTaggedCollection,
  matchCollection,
  Schema,
  tagCollection,
  TaggedCollection,
  Field,
} from "./Schema";
import { indent, Logger } from "./Logger";
import { Json, JsonRecord } from "./Json";
import {
  Stack,
  Warning,
  pushStackFrame,
  pushWarning,
  captureWarning,
} from "./Stack";
import {
  FieldValue,
  ObjectFieldValue,
  ListFieldValue,
  createFieldsSchema,
} from "./Validator";
import { assertZod } from "./Zod";

export type FieldAstNode = {
  readonly field: Field;
  readonly value: FieldValue;
  readonly objectChildren?: Record<string, FieldAstNode>;
  readonly arrayChildren?: FieldAstNode[];
};

const FieldAstNode: z.ZodSchema<FieldAstNode> = z.lazy(() =>
  z.object({
    field: Field,
    value: Json,
    objectChildren: z.record(FieldAstNode).optional(),
    arrayChildren: z.array(FieldAstNode).optional(),
  }),
);

const BaseContentAstNode = z.object({
  sourceLocation: z.string(),
  slug: z.string(),
  locale: z.string().nullable(),
  raw: z.string(),
  propsNodes: z.array(FieldAstNode),
});

const FolderCollectionContentAstNode = BaseContentAstNode.extend({
  kind: z.literal(`folder`),
  collection: FolderTaggedCollection,
});

const FilesCollectionContentAstNode = BaseContentAstNode.extend({
  kind: z.literal(`files`),
  file: z.string(),
  collection: FilesTaggedCollection,
});

const ContentAstNode = z.union([
  FolderCollectionContentAstNode,
  FilesCollectionContentAstNode,
]);

export type ContentAstNode = z.infer<typeof ContentAstNode>;

const CollectionAstNode = z.object({
  collection: TaggedCollection,
  contents: z.array(ContentAstNode),
});

export type CollectionAstNode = z.infer<typeof CollectionAstNode>;

const sortContentNodes = (a: ContentAstNode, b: ContentAstNode): number =>
  a.sourceLocation.localeCompare(b.sourceLocation);

const ParserContext = z.object({
  warnings: z.array(Warning),
});

type ParserContext = z.infer<typeof ParserContext>;

export const ParseResult = z.object({
  schema: Schema,
  warnings: z.array(Warning),
  collections: z.array(CollectionAstNode),
});

export type ParseResult = z.infer<typeof ParseResult>;

const parseField = (
  schema: Schema,
  ctx: ParserContext,
  parentStack: Stack,
  collection: TaggedCollection,
  value: Json,
  field: Field,
): FieldAstNode => {
  const stack = pushStackFrame(parentStack, {
    fn: `parseField`,
    params: { collection, field, value },
  });
  if (field.widget === `object`) {
    assertZod(ObjectFieldValue, value);
    return {
      field,
      value,
      objectChildren: field.fields
        .map(
          (
            childField,
          ): {
            readonly key: string;
            readonly fieldNode: FieldAstNode;
          } => {
            const childValue = value[childField.name];
            const childFieldNode = parseField(
              schema,
              ctx,
              stack,
              collection,
              childValue,
              childField,
            );
            return {
              key: childField.name,
              fieldNode: childFieldNode,
            };
          },
        )
        .reduce(
          (objectChildren, { key, fieldNode }) => ({
            ...objectChildren,
            [key]: fieldNode,
          }),
          {} as Record<string, FieldAstNode>,
        ),
    };
  }
  if (field.widget === `list`) {
    assertZod(ListFieldValue, value);
    const childField = field.field;
    if (childField) {
      return {
        field,
        value,
        arrayChildren: value.map((childValue) =>
          parseField(schema, ctx, stack, collection, childValue, childField),
        ),
      };
    }
    const childFields = field.fields;
    if (childFields) {
      const childField: Field = {
        name: `${field.name}.child`,
        widget: `object`,
        i18n: field.i18n,
        fields: childFields,
      };
      return {
        field,
        value,
        arrayChildren: value.map((childValue) =>
          parseField(schema, ctx, stack, collection, childValue, childField),
        ),
      };
    }
  }

  return {
    field,
    value,
  };
};

const resolveFolderCollectionI18nStructure = (
  schema: Schema,
  ctx: ParserContext,
  parentStack: Stack,
  collection: FolderTaggedCollection,
): null | FolderCollectionI18nStructure => {
  const stack = pushStackFrame(parentStack, {
    fn: `resolveFolderCollectionI18nStructure`,
    params: {
      collection,
    },
  });
  if (!collection.i18n) {
    return null;
  }
  if (collection.i18n === true) {
    if (schema.i18n) {
      return schema.i18n.structure;
    } else {
      return pushWarning(ctx, {
        stack,
        message: `No global i18n structure provided`,
        details: { collection },
      });
    }
  }
  return collection.i18n.structure;
};

const resolveFilesCollectionI18nStructure = (
  schema: Schema,
  ctx: ParserContext,
  parentStack: Stack,
  collection: FilesTaggedCollection,
): null | FilesCollectionI18nStructure => {
  const stack = pushStackFrame(parentStack, {
    fn: `resolveFilesCollectionI18nStructure`,
    params: {
      collection: collection.name,
    },
  });
  if (!collection.i18n) {
    return null;
  }
  if (collection.i18n === true) {
    if (schema.i18n?.structure !== `single_file`) {
      return pushWarning(ctx, {
        stack,
        message: `Global i18n structure should be 'single_file'`,
        details: { collection },
      });
    }
    return schema.i18n.structure;
  }
  return collection.i18n.structure;
};

const parseFileContents = (file: string, raw: string): JsonRecord => {
  const { ext } = parsePath(file);

  if (ext === `.md` || ext === `.mdx`) {
    const { data, content } = parseMatter(raw);
    return {
      ...data,
      body: content,
    };
  }

  if (ext === `.yml` || ext === `.yml`) {
    return JsonRecord.parse(load(raw));
  }

  throw new Error(`Unknown file extension: ${ext}`);
};

const parseFilePath = (
  path: ParsedPath,
  i18nStructure: null | `multiple_files` | `multiple_folders`,
): { readonly slug: string; readonly locale: null | string } => {
  if (i18nStructure === `multiple_files`) {
    // {slug}.{locale}.{extension}
    const fileNameParts = path.name.split(`.`);
    const slug = fileNameParts.slice(0, -1).join(`.`);
    const locale = fileNameParts[fileNameParts.length - 1];
    return { slug, locale };
  } else if (i18nStructure === `multiple_folders`) {
    // {locale}/{slug}.{extension}
    const parentFolders = path.dir.split(sep);
    const locale = parentFolders[parentFolders.length - 1];
    return {
      slug: path.name,
      locale,
    };
  } else {
    return {
      slug: path.name,
      locale: null,
    };
  }
};

const parseProps = (
  schema: Schema,
  ctx: ParserContext,
  stack: Stack,
  collection: TaggedCollection,
  props: Json,
  fields: Field[],
): null | FieldAstNode[] =>
  captureWarning(
    ctx,
    pushStackFrame(stack, {
      fn: `parseProps`,
      params: {
        props,
      },
    }),
    () => {
      const fieldsSchema = createFieldsSchema(fields);
      assertZod(fieldsSchema, props);
      return fields.map((field) =>
        parseField(schema, ctx, stack, collection, props[field.name], field),
      );
    },
  );

const parseFolderCollectionFile = (
  schema: Schema,
  ctx: ParserContext,
  parentStack: Stack,
  collection: FolderTaggedCollection,
  sourceLocation: string,
  raw: string,
): ContentAstNode[] => {
  const stack = pushStackFrame(parentStack, {
    fn: `parseFolderCollectionFile`,
    params: { collection: collection.name, sourceLocation },
  });
  const i18nStructure = resolveFolderCollectionI18nStructure(
    schema,
    ctx,
    stack,
    collection,
  );

  const path = parsePath(sourceLocation);

  if (i18nStructure !== `single_file`) {
    const { slug, locale } = parseFilePath(path, i18nStructure);
    const props = parseFileContents(sourceLocation, raw);
    const propsNodes = parseProps(
      schema,
      ctx,
      pushStackFrame(stack, {
        fn: `parseFolderCollectionFile`,
        params: {
          i18n: i18nStructure,
          locale,
        },
      }),
      collection,
      props,
      collection.fields,
    );
    if (!propsNodes) {
      return [];
    }
    return [
      {
        sourceLocation,
        kind: `folder`,
        collection,
        slug,
        locale,
        raw,
        propsNodes,
      },
    ];
  } else {
    const fileContents = parseFileContents(sourceLocation, raw);
    const locales = Object.keys(fileContents);
    const { slug } = parseFilePath(path, null);
    return locales
      .map((locale): null | ContentAstNode => {
        const props = fileContents[locale];

        const propsNodes = parseProps(
          schema,
          ctx,
          pushStackFrame(stack, {
            fn: `parseFolderCollectionFile`,
            params: { i18n: i18nStructure, locale },
          }),
          collection,
          props,
          collection.fields,
        );
        if (!propsNodes) {
          return null;
        }
        return {
          sourceLocation,
          kind: `folder`,
          collection,
          slug,
          locale,
          raw,
          propsNodes,
        };
      })
      .filter(isNotNull);
  }
};

const parseFilesCollectionFile = (
  schema: Schema,
  ctx: ParserContext,
  parentStack: Stack,
  collection: FilesTaggedCollection,
  item: FilesCollectionItem,
  sourceLocation: string,
  raw: string,
): ContentAstNode[] => {
  const stack = pushStackFrame(parentStack, {
    fn: `parseFilesCollectionFile`,
    params: {
      collection: collection.name,
      sourceLocation,
    },
  });
  const collectionI18nStructure = resolveFilesCollectionI18nStructure(
    schema,
    ctx,
    stack,
    collection,
  );

  const path = parsePath(sourceLocation);

  const { slug } = parseFilePath(path, null);

  const itemI18nStructure = item.i18n ? collectionI18nStructure : null;

  if (itemI18nStructure === `single_file`) {
    const fileContents = parseFileContents(sourceLocation, raw);
    const locales = Object.keys(fileContents);
    return locales
      .map((locale): null | ContentAstNode => {
        const props = fileContents[locale];

        const propsNodes = parseProps(
          schema,
          ctx,
          pushStackFrame(stack, {
            fn: `parseFilesCollectionFile`,
            params: {
              i18n: itemI18nStructure,
              locale,
            },
          }),
          collection,
          props,
          item.fields,
        );
        if (!propsNodes) {
          return null;
        }
        return {
          sourceLocation,
          file: item.name,
          kind: `files`,
          collection,
          slug,
          locale,
          raw,
          propsNodes,
        };
      })
      .filter(isNotNull);
  }

  const props = parseFileContents(sourceLocation, raw);

  const propsNodes = parseProps(
    schema,
    ctx,
    pushStackFrame(stack, {
      fn: `parseFilesCollectionFile`,
      params: {
        i18n: itemI18nStructure,
      },
    }),
    collection,
    props,
    item.fields,
  );

  if (!propsNodes) {
    return [];
  }

  return [
    {
      sourceLocation,
      file: item.name,
      kind: `files`,
      collection,
      slug,
      locale: null,
      raw,
      propsNodes,
    },
  ];
};

const parseCollection = async (
  cwd: string,
  schema: Schema,
  ctx: ParserContext,
  parentStack: Stack,
  collection: TaggedCollection,
): Promise<CollectionAstNode> => {
  const stack = pushStackFrame(parentStack, {
    fn: `parseCollection`,
    params: {
      collection: collection.name,
    },
  });
  const contents = await matchCollection(collection, {
    folder: async (collection) => {
      const paths = await globby(`**/*.{md,yml,yaml}`, {
        cwd: resolve(cwd, collection.folder),
      });
      return mapAsync(paths, async (path) => {
        const file = resolve(cwd, collection.folder, path);
        const sourceLocation = relative(cwd, file);
        const sourceRaw = await readFile(file, {
          encoding: `utf-8`,
        });
        return parseFolderCollectionFile(
          schema,
          ctx,
          stack,
          collection,
          sourceLocation,
          sourceRaw,
        );
      }).then((nodes) => nodes.flat().sort(sortContentNodes));
    },
    files: async (collection) => {
      return mapAsync(collection.files, async (item) => {
        const sourceLocation = item.file;
        const file = resolve(cwd, sourceLocation);
        const sourceRaw = await readFile(file, {
          encoding: `utf8`,
        });
        return parseFilesCollectionFile(
          schema,
          ctx,
          stack,
          collection,
          item,
          sourceLocation,
          sourceRaw,
        );
      }).then((nodes) => nodes.flat().sort(sortContentNodes));
    },
  });
  return {
    collection,
    contents,
  };
};

export const parse = async (
  cwd: string,
  schema: Schema,
): Promise<ParseResult> => {
  const ctx: ParserContext = {
    warnings: [],
  };
  const stack = pushStackFrame([], {
    fn: `parseCollections`,
    params: {},
  });
  const collections = await mapAsync(schema.collections, (collection) =>
    parseCollection(cwd, schema, ctx, stack, tagCollection(collection)),
  ).then((collectionAstNodes) =>
    collectionAstNodes.sort((a, b) =>
      a.collection.name.localeCompare(b.collection.name),
    ),
  );

  return {
    warnings: ctx.warnings,
    schema,
    collections,
  };
};

export const prettyPrintParseResult = (
  { warnings, collections }: ParseResult,
  logger: Logger,
): void => {
  logger.log(
    `${collections.length} collections parsed with total ${collections.reduce(
      (length, collection) => length + collection.contents.length,
      0,
    )} contents and ${warnings.length} warnings.`,
  );

  logger.log(indent(2, `Collections (${collections.length}):`));

  for (let k = 0; k < collections.length; k++) {
    const { collection, contents } = collections[k];
    logger.log(
      indent(
        4,
        `(${k + 1}/${collections.length}) collection '${collection.name}': ${
          contents.length
        } contents.`,
      ),
    );
    for (const content of contents) {
      logger.info(indent(6, content.sourceLocation));
    }
  }

  logger.warn(indent(2, `Warnings (${warnings.length}):`));

  for (let k = 0; k < warnings.length; k++) {
    const warning = warnings[k];
    logger.warn(
      indent(4, `(${k + 1}/${warnings.length}) warning: ${warning.message}`),
    );
    logger.info(indent(6, `details`));
    logger.info(
      indent(
        8,
        typeof warning.details === `string`
          ? warning.details
          : inspect(warning.details, { depth: 4 }),
      ),
    );
    logger.info(indent(6, `stack`));
    logger.info(indent(8, inspect(warning.stack, { depth: 4 })));
  }
};
