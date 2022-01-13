import { join, resolve } from "path";

import { z } from "zod";
import { ts } from "ts-morph";
import { ESLint } from "eslint";
import { paramCase } from "change-case";

import {
  CollectionAstNode,
  ContentAstNode,
  FieldAstNode,
  ParseResult,
} from "./Parser";
import { Collection, Field } from "./Schema";
import { Logger } from "./Logger";
import {
  createContentsTypeAliasDeclaration,
  createMarkdownTypeImportDeclaration,
  createSchemaTypeAliasDeclaration,
} from "./TypeEmitter";
import { assertZod } from "./Zod";

const {
  createArrayLiteralExpression,
  createArrowFunction,
  createCallExpression,
  createComputedPropertyName,
  createIdentifier,
  createImportClause,
  createImportDeclaration,
  createImportSpecifier,
  createModifier,
  createNamedImports,
  createNewExpression,
  createNoSubstitutionTemplateLiteral,
  createNull,
  createObjectLiteralExpression,
  createPropertyAssignment,
  createStringLiteral,
  createToken,
  createTypeReferenceNode,
  createVariableDeclaration,
  createVariableDeclarationList,
  createVariableStatement,
} = ts.factory;

const {
  SyntaxKind,
  createSourceFile,
  createPrinter,
  NodeFlags,
  ScriptTarget,
  EmitHint,
} = ts;

const Asset = z.object({
  path: z.string(),
  source: z.string(),
});

type Asset = z.infer<typeof Asset>;

type Context = {
  readonly markdownAssets: Asset[];
};

const pushMarkdownAsset = (ctx: Context, markdownAsset: Asset): void => {
  ctx.markdownAssets.push(markdownAsset);
};

type EmitterOptions = {
  readonly outFolder: string;
  readonly markdownLoaderModule: string;
  readonly markdownLoaderIdentifier: string;
  readonly markdownTypeModule: string;
  readonly markdownTypeIdentifier: string;
  readonly raw?: boolean;
  readonly sourceLocation?: boolean;
  readonly eslintConfig?: string;
};

const EmitResult = z.object({
  index: Asset,
  markdownAssets: z.array(Asset),
});

type EmitResult = z.infer<typeof EmitResult>;

type FieldStackFrame =
  | {
      readonly kind: `field`;
      readonly field: Field;
    }
  | {
      readonly kind: `discriminator`;
      readonly value: string;
    };

type FieldStack = {
  readonly collection: Collection;
  readonly slug: string;
  readonly locale: null | string;
  readonly path: FieldStackFrame[];
};

const pushFieldStack = (
  fieldStack: FieldStack,
  FieldStackFrame: FieldStackFrame,
): FieldStack => ({
  ...fieldStack,
  path: [...fieldStack.path, FieldStackFrame],
});

const createMarkdownAssetPath = (
  ctx: Context,
  { collection, slug, locale, path }: FieldStack,
): string => {
  const parts = [collection.name];
  if (slug) {
    parts.push(slug);
  }
  if (locale) {
    parts.push(locale);
  }
  for (const fieldStackFrame of path) {
    if (fieldStackFrame.kind === `field`) {
      parts.push(fieldStackFrame.field.name);
    } else {
      parts.push(fieldStackFrame.value);
    }
  }
  const basePath = join(...parts.map((part) => paramCase(part)));
  const fullPath = `${basePath}.md`;
  if (
    ctx.markdownAssets.some((markdownAsset) => markdownAsset.path === fullPath)
  ) {
    throw new Error(`Markdown asset name conflict: ${fullPath}`);
  }
  return fullPath;
};

const createJsonExpression = (value: unknown): ts.Expression =>
  ts.parseJsonText(``, JSON.stringify(value, null, 2)).statements[0].expression;

const createLoaderImportExpression = (
  loaderIdentifier: ts.Identifier,
  relativeFileName: string,
): ts.Expression =>
  createCallExpression(loaderIdentifier, undefined, [
    createArrowFunction(
      [],
      [],
      [],
      undefined,
      createToken(SyntaxKind.EqualsGreaterThanToken),
      createCallExpression(
        createToken(SyntaxKind.ImportKeyword) as ts.Expression,
        undefined,
        [createStringLiteral(`./${relativeFileName}`)],
      ),
    ),
  ]);

const createFieldNodeExpression = (
  opts: EmitterOptions,
  ctx: Context,
  parentFieldStack: FieldStack,
  field: FieldAstNode,
): ts.Expression => {
  const fieldStack = pushFieldStack(parentFieldStack, {
    kind: `field`,
    field: field.field,
  });

  if (field.field.widget === `datetime`) {
    assertZod(z.date(), field.value);
    return createNewExpression(createIdentifier(`Date`), undefined, [
      createStringLiteral(field.value.toISOString()),
    ]);
  }

  if (field.field.widget === `list`) {
    return createArrayLiteralExpression(
      field.arrayChildren?.map((childFieldNode, index) =>
        createFieldNodeExpression(
          opts,
          ctx,
          pushFieldStack(fieldStack, {
            kind: `discriminator`,
            value: `${index}`,
          }),
          childFieldNode,
        ),
      ) ?? [],
    );
  }

  if (field.field.widget === `markdown`) {
    const path = createMarkdownAssetPath(ctx, fieldStack);
    const source = field.value;
    assertZod(z.string(), source);
    const markdownAsset: Asset = {
      path,
      source,
    };
    pushMarkdownAsset(ctx, markdownAsset);
    return createLoaderImportExpression(createIdentifier(`loadMarkdown`), path);
  }

  if (field.field.widget === `number` && field.field.value_type === `float`) {
    assertZod(z.string(), field.value);
    return createJsonExpression(parseFloat(field.value));
  }

  if (field.field.widget === `object`) {
    return createObjectLiteralExpression(
      Object.entries(field.objectChildren ?? {}).reduce(
        (properties, [key, childFieldNode]) => [
          ...properties,
          createPropertyAssignment(
            createComputedPropertyName(createStringLiteral(key)),
            createFieldNodeExpression(
              opts,
              ctx,
              pushFieldStack(fieldStack, { kind: `discriminator`, value: key }),
              childFieldNode,
            ),
          ),
        ],
        [] as ts.PropertyAssignment[],
      ),
    );
  }

  return createJsonExpression(field.value);
};

const createContentNodeExpression = (
  opts: EmitterOptions,
  ctx: Context,
  content: ContentAstNode,
): ts.Expression => {
  const properties: ts.ObjectLiteralElementLike[] = [
    createPropertyAssignment(
      `collection`,
      createStringLiteral(content.collection.name),
    ),
    createPropertyAssignment(
      `kind`,
      createStringLiteral(content.collection.kind),
    ),
  ];

  if (content.kind === `files`) {
    properties.push(
      createPropertyAssignment(`file`, createStringLiteral(content.file)),
    );
  }

  properties.push(
    createPropertyAssignment(`slug`, createStringLiteral(content.slug)),
    createPropertyAssignment(
      `locale`,
      content.locale === null
        ? createNull()
        : createStringLiteral(content.locale),
    ),
    createPropertyAssignment(
      `props`,
      createObjectLiteralExpression(
        content.propsNodes.map((propsNode) =>
          createPropertyAssignment(
            createComputedPropertyName(
              createStringLiteral(propsNode.field.name),
            ),
            createFieldNodeExpression(
              opts,
              ctx,
              {
                collection: content.collection,
                locale: content.locale,
                path: [],
                slug: content.slug,
              },
              propsNode,
            ),
          ),
        ),
      ),
    ),
  );

  if (opts.raw) {
    properties.push(
      createPropertyAssignment(
        `raw`,
        createNoSubstitutionTemplateLiteral(content.raw),
      ),
    );
  }

  if (opts.sourceLocation) {
    properties.push(
      createPropertyAssignment(
        `sourceLocation`,
        createStringLiteral(content.sourceLocation),
      ),
    );
  }

  return createObjectLiteralExpression(properties);
};

const createCollectionExpression = (
  opts: EmitterOptions,
  ctx: Context,
  collection: CollectionAstNode,
): ts.Expression => {
  if (collection.collection.kind === `folder`) {
    return createArrayLiteralExpression(
      collection.contents.map((content) =>
        createContentNodeExpression(opts, ctx, content),
      ),
    );
  }

  const files = collection.collection.files.map((file) => file.name);

  return createObjectLiteralExpression(
    files.map((file) =>
      createPropertyAssignment(
        createComputedPropertyName(createStringLiteral(file)),
        createArrayLiteralExpression(
          collection.contents
            .filter(
              (content) => content.kind === `files` && content.file === file,
            )
            .map((content) => createContentNodeExpression(opts, ctx, content)),
        ),
      ),
    ),
  );
};

const createContentsExpression = (
  opts: EmitterOptions,
  ctx: Context,
  collections: CollectionAstNode[],
): ts.Expression =>
  createObjectLiteralExpression(
    collections.map((collection) =>
      createPropertyAssignment(
        createComputedPropertyName(
          createStringLiteral(collection.collection.name),
        ),
        createCollectionExpression(opts, ctx, collection),
      ),
    ),
  );

const createMarkdownLoaderImportDeclaration = (
  opts: EmitterOptions,
): ts.ImportDeclaration =>
  createImportDeclaration(
    [],
    [],
    createImportClause(
      false,
      undefined,
      createNamedImports([
        createImportSpecifier(
          false,
          createIdentifier(opts.markdownLoaderIdentifier),
          createIdentifier(`loadMarkdown`),
        ),
      ]),
    ),
    createStringLiteral(opts.markdownLoaderModule),
  );

const createIndexTsNodes = (
  opts: EmitterOptions,
  ctx: Context,
  { collections, schema }: ParseResult,
): ts.Node[] => {
  const markdownLoaderImportDeclaration =
    createMarkdownLoaderImportDeclaration(opts);
  const markdownTypeImportDeclaration =
    createMarkdownTypeImportDeclaration(opts);

  const schemaTypeAliasDeclaration = createSchemaTypeAliasDeclaration(
    opts,
    schema,
  );
  const contentsTypeAliasDeclaration =
    createContentsTypeAliasDeclaration(schema);

  const contentsDeclaration = createVariableStatement(
    [createModifier(SyntaxKind.ExportKeyword)],
    createVariableDeclarationList(
      [
        createVariableDeclaration(
          `contents`,
          undefined,
          createTypeReferenceNode(`Contents`),
          createContentsExpression(opts, ctx, collections),
        ),
      ],
      NodeFlags.Const,
    ),
  );

  return [
    markdownLoaderImportDeclaration,
    markdownTypeImportDeclaration,
    schemaTypeAliasDeclaration,
    contentsTypeAliasDeclaration,
    contentsDeclaration,
  ];
};

const formatSource = async (
  opts: EmitterOptions,
  filePath: string,
  rawSource: string,
): Promise<string> => {
  const eslint = new ESLint({
    fix: true,
    overrideConfigFile: opts.eslintConfig,
  });

  const [result] = await eslint.lintText(rawSource, {
    filePath,
  });

  if (!result.output) {
    const fmt = await eslint.loadFormatter();
    const message = fmt.format([result]);
    throw new Error(`${message}\n${rawSource}`);
  }

  return result.output;
};

const headerRawSource = `
/***********************************************/
/*                                             */
/*   This file was generated by as script.     */
/*  DO NOT EDIT manually as any changes will   */
/*               be overwritten.               */
/*                                             */
/***********************************************/
`
  .split(`\n`)
  .filter((line) => line.length > 0)
  .join(`\n`);

export const emit = async (
  cwd: string,
  opts: EmitterOptions,
  parseResult: ParseResult,
): Promise<EmitResult> => {
  const ctx: Context = {
    markdownAssets: [],
  };
  const indexPath = resolve(cwd, opts.outFolder, `assets.next`, `index.ts`);
  const indexTsFile = createSourceFile(indexPath, ``, ScriptTarget.Latest);
  const tsPrinter = createPrinter();

  const printTsNodeStatement = (node: ts.Node): string =>
    `${tsPrinter.printNode(EmitHint.Unspecified, node, indexTsFile)};\n`;

  const indexTsNodes = createIndexTsNodes(opts, ctx, parseResult)
    .map(printTsNodeStatement)
    .join(`\n`);

  const indexRawSource = [headerRawSource, indexTsNodes].join(`\n`);

  const indexSource = await formatSource(opts, indexPath, indexRawSource);

  return {
    index: {
      path: `index.ts`,
      source: indexSource,
    },
    markdownAssets: ctx.markdownAssets,
  };
};

export const prettyPrintEmitResult = (
  result: EmitResult,
  logger: Logger,
): void => {
  logger.log(
    `Index and ${result.markdownAssets.length} markdown assets emitted.`,
  );
};
