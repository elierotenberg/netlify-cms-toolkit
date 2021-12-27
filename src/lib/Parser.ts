import { parse as parsePath, sep, ParsedPath, resolve, relative } from "path";
import { readFile } from "fs/promises";
import { inspect } from "util";

import parseMatter from "gray-matter";
import { load } from "js-yaml";
import globby from "globby";
import { z } from "zod";

import { isRecord, mapAsync, isNotNull } from "./util";
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
import { Json } from "./Json";
import { Stack, Warning, pushStackFrame, pushWarning } from "./Stack";

export type FieldAstNode = {
  readonly field: Field;
  readonly value: Json;
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

const Meta = z.record(Json);

type Meta = z.infer<typeof Meta>;

const ContentAstNode = z.object({
  sourceLocation: z.string(),
  collection: TaggedCollection,
  slug: z.string(),
  locale: z.string().nullable(),
  sourceRaw: z.string(),
  meta: Meta,
  rootFieldNode: FieldAstNode,
});

export type ContentAstNode = z.infer<typeof ContentAstNode>;

const CollectionAstNode = z.object({
  collection: TaggedCollection,
  contents: z.array(ContentAstNode),
});

export type CollectionAstNode = z.infer<typeof CollectionAstNode>;

const sortContentNodes = (a: ContentAstNode, b: ContentAstNode): number =>
  a.sourceLocation.localeCompare(b.sourceLocation);

const Context = z.object({
  warnings: z.array(Warning),
});

type Context = z.infer<typeof Context>;

export const ParseResult = z.object({
  schema: Schema,
  warnings: z.array(Warning),
  collections: z.array(CollectionAstNode),
});

export type ParseResult = z.infer<typeof ParseResult>;

const parseField = (
  schema: Schema,
  ctx: Context,
  parentStack: Stack,
  collection: TaggedCollection,
  value: Json,
  field: Field,
): null | FieldAstNode => {
  const stack = pushStackFrame(parentStack, {
    fn: `parseField`,
    params: { collection, field, value },
  });
  if (field.widget === `object`) {
    if (!isRecord(value)) {
      return pushWarning(ctx, {
        stack,
        message: `Value of 'object' widget should be a record`,
        details: { value },
      });
    }
    return {
      field,
      value,
      objectChildren: field.fields
        .map(
          (
            childField,
          ): null | {
            readonly key: string;
            readonly fieldNode: FieldAstNode;
          } => {
            const childValue = value[childField.name];
            if (typeof childValue === `undefined`) {
              return pushWarning(ctx, {
                stack,
                message: `Property '${childField.name}' not found`,
                details: {
                  value,
                },
              });
            }
            const childFieldNode = parseField(
              schema,
              ctx,
              stack,
              collection,
              childValue,
              childField,
            );
            if (!childFieldNode) {
              return null;
            }
            return {
              key: childField.name,
              fieldNode: childFieldNode,
            };
          },
        )
        .filter(isNotNull)
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
    if (!Array.isArray(value)) {
      return pushWarning(ctx, {
        stack,
        message: `Value of 'list' widget should be an array`,
        details: { value },
      });
    }
    const childField = field.field;
    if (childField) {
      return {
        field,
        value,
        arrayChildren: value
          .map((childValue) =>
            parseField(schema, ctx, stack, collection, childValue, childField),
          )
          .filter(isNotNull),
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
        arrayChildren: value
          .map((childValue) =>
            parseField(schema, ctx, stack, collection, childValue, childField),
          )
          .filter(isNotNull),
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
  ctx: Context,
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
  ctx: Context,
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

const parseMeta = (
  ctx: Context,
  parentStack: Stack,
  sourceLocation: string,
  sourceRaw: string,
): null | Meta => {
  const stack = pushStackFrame(parentStack, {
    fn: `parseMeta`,
    params: { sourceLocation },
  });
  const { ext } = parsePath(sourceLocation);
  if (ext === `.md`) {
    return Meta.parse(parseMatter(sourceRaw).data);
  }
  if (ext === `.yml` || ext === `.yaml`) {
    const meta = Json.parse(load(sourceRaw));
    if (!isRecord(meta)) {
      return pushWarning(ctx, {
        stack,
        message: `Yaml data should be a record.`,
        details: { meta },
      });
    }
    return meta;
  }

  return pushWarning(ctx, {
    stack,
    message: `Unknown file extension: ${ext}`,
    details: { sourceLocation },
  });
};

const getDefaultMarkdownFieldName = (fields: Field[]): null | string => {
  const markdownFields = fields.filter((field) => field.widget === `markdown`);
  if (markdownFields.length === 1) {
    return markdownFields[0].name;
  }
  return null;
};

const inlineDefaultMarkdownField = (
  fields: Field[],
  meta: Meta,
  sourceRaw: string,
): Meta => {
  const defaultMarkdownFieldName = getDefaultMarkdownFieldName(fields);
  if (!defaultMarkdownFieldName) {
    return meta;
  }
  return {
    ...meta,
    [defaultMarkdownFieldName]: sourceRaw,
  };
};

const parseSourceLocation = (
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

const parseFolderCollectionFile = (
  schema: Schema,
  ctx: Context,
  parentStack: Stack,
  collection: FolderTaggedCollection,
  sourceLocation: string,
  sourceRaw: string,
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

  const meta = parseMeta(ctx, stack, sourceLocation, sourceRaw) ?? {};

  const path = parsePath(sourceLocation);

  if (i18nStructure !== `single_file`) {
    const { slug, locale } = parseSourceLocation(path, i18nStructure);
    const rootFieldNode = parseField(
      schema,
      ctx,
      stack,
      collection,
      inlineDefaultMarkdownField(collection.fields, meta, sourceRaw),
      {
        name: `root`,
        widget: `object`,
        fields: collection.fields,
      },
    );
    if (!rootFieldNode) {
      return [];
    }
    return [
      {
        sourceLocation,
        collection,
        slug,
        locale,
        sourceRaw,
        meta,
        rootFieldNode,
      },
    ];
  } else {
    const locales = Object.keys(meta);
    return locales
      .map((locale) => {
        const localeMeta = meta[locale];
        if (!isRecord(localeMeta)) {
          return pushWarning(ctx, {
            stack,
            message: `meta['${locale}'] should be a record`,
            details: { locale, meta },
          });
        }
        const rootFieldNode = parseField(
          schema,
          ctx,
          stack,
          collection,
          localeMeta,
          {
            name: locale,
            widget: `object`,
            fields: collection.fields,
          },
        );
        if (!rootFieldNode) {
          return null;
        }
        return {
          sourceLocation,
          collection,
          slug: path.name,
          locale,
          sourceRaw,
          meta: localeMeta,
          rootFieldNode,
        };
      })
      .filter(isNotNull);
  }
};

const parseFilesCollectionFile = (
  schema: Schema,
  ctx: Context,
  parentStack: Stack,
  collection: FilesTaggedCollection,
  item: FilesCollectionItem,
  sourceLocation: string,
  sourceRaw: string,
): ContentAstNode[] => {
  const stack = pushStackFrame(parentStack, {
    fn: `parseFilesCollectionFile`,
    params: {
      collection: collection.name,
      file: item.file,
      sourceLocation,
    },
  });
  const collectionI18nStructure = resolveFilesCollectionI18nStructure(
    schema,
    ctx,
    stack,
    collection,
  );

  const meta = parseMeta(ctx, stack, sourceLocation, sourceRaw) ?? {};

  const path = parsePath(sourceLocation);

  const itemI18nStructure = item.i18n ? collectionI18nStructure : null;
  if (itemI18nStructure === `single_file`) {
    const locales = Object.keys(meta);
    return locales
      .map((locale) => {
        const localeMeta = meta[locale];
        if (!isRecord(localeMeta)) {
          return pushWarning(ctx, {
            stack,
            message: `meta['${locale}'] should be a record`,
            details: {
              meta,
              locale,
            },
          });
        }
        const rootFieldNode = parseField(
          schema,
          ctx,
          stack,
          collection,
          localeMeta,
          {
            name: locale,
            widget: `object`,
            fields: item.fields,
          },
        );
        if (!rootFieldNode) {
          return null;
        }
        return {
          sourceLocation,
          collection,
          slug: path.name,
          locale,
          sourceRaw,
          meta: localeMeta,
          rootFieldNode,
        };
      })
      .filter(isNotNull);
  }
  const { slug } = parseSourceLocation(path, null);
  const rootFieldNode = parseField(
    schema,
    ctx,
    stack,
    collection,
    inlineDefaultMarkdownField(item.fields, meta, sourceRaw),
    {
      name: `root`,
      widget: `object`,
      fields: item.fields,
    },
  );
  if (!rootFieldNode) {
    return [];
  }
  return [
    {
      sourceLocation,
      collection,
      slug,
      locale: null,
      sourceRaw,
      meta,
      rootFieldNode,
    },
  ];
};

const parseCollection = async (
  cwd: string,
  schema: Schema,
  ctx: Context,
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
        try {
          const sourceLocation = resolve(cwd, collection.folder, path);
          const sourceRaw = await readFile(sourceLocation, {
            encoding: `utf-8`,
          });
          return parseFolderCollectionFile(
            schema,
            ctx,
            stack,
            collection,
            relative(cwd, sourceLocation),
            sourceRaw,
          );
        } catch (error) {
          pushWarning(ctx, {
            message: error.message,
            details: error,
            stack,
          });
          return [];
        }
      }).then((nodes) => nodes.flat().sort(sortContentNodes));
    },
    files: async (collection) => {
      return mapAsync(collection.files, async (item) => {
        try {
          const sourceLocation = resolve(cwd, item.file);
          const sourceRaw = await readFile(sourceLocation, {
            encoding: `utf8`,
          });
          return parseFilesCollectionFile(
            schema,
            ctx,
            stack,
            collection,
            item,
            relative(cwd, sourceLocation),
            sourceRaw,
          );
        } catch (error) {
          pushWarning(ctx, {
            message: error.message,
            details: error,
            stack,
          });
          return [];
        }
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
  const ctx: Context = {
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
    logger.info(indent(8, inspect(warning.details, { depth: 4 })));
    logger.info(indent(6, `stack`));
    logger.info(indent(8, inspect(warning.stack, { depth: 4 })));
  }
};
