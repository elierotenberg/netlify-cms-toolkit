import { join, resolve } from "path";
import { readFile } from "fs/promises";

import { z } from "zod";
import { ts } from "ts-morph";
import { paramCase } from "change-case";
import { ESLint } from "eslint";

import {
  CollectionAstNode,
  ContentAstNode,
  FieldAstNode,
  ParseResult,
} from "./Parser";
import { Collection, Field } from "./Schema";
import { pushStackFrame, pushWarning, Stack, Warning } from "./Stack";
import { Logger } from "./Logger";
import { applyCasing, Casing } from "./util";

const {
  createArrayLiteralExpression,
  createArrowFunction,
  createAsExpression,
  createCallExpression,
  createIdentifier,
  createImportClause,
  createImportDeclaration,
  createIndexedAccessTypeNode,
  createModifier,
  createKeywordTypeNode,
  createNoSubstitutionTemplateLiteral,
  createNull,
  createObjectLiteralExpression,
  createPropertyAssignment,
  createStringLiteral,
  createToken,
  createTypeAliasDeclaration,
  createTypeQueryNode,
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
  readonly warnings: Warning[];
  readonly markdownAssets: Asset[];
};

const pushMarkdownAsset = (ctx: Context, markdownAsset: Asset): void => {
  ctx.markdownAssets.push(markdownAsset);
};

type EmitterOptions = {
  readonly outFolder: string;
  readonly markdownLoader: string;
  readonly raw?: boolean;
  readonly eslintConfig?: string;
  readonly markdownPropertyCasing?: Casing;
  readonly propertyCasing?: Casing;
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
  stack: Stack,
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
  const basePath = join(`assets`, ...parts.map((part) => paramCase(part)));
  const fullPath = `${basePath}.md`;
  if (
    ctx.markdownAssets.some((markdownAsset) => markdownAsset.path === fullPath)
  ) {
    pushWarning(ctx, {
      message: `Markdown asset name conflict`,
      stack,
      details: { fullPath },
    });
    let k = 0;
    while (
      ctx.markdownAssets.some(
        (markdownAsset) => markdownAsset.path === `${basePath}_${k}.md`,
      )
    ) {
      k++;
    }
    return `${basePath}_${k}.md`;
  }
  return fullPath;
};

const createAsConstExpression = (expression: ts.Expression): ts.Expression =>
  createAsExpression(expression, createTypeReferenceNode(`const`));

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

const applyMarkdownPropertyCasing = (
  opts: EmitterOptions,
  identifier: string,
): string =>
  applyCasing(
    opts.markdownPropertyCasing ?? opts.propertyCasing ?? `preserve`,
    identifier,
  );

const applyPropertyCasing = (
  opts: EmitterOptions,
  identifier: string,
): string => applyCasing(opts.propertyCasing ?? `preserve`, identifier);

const createFieldNodeExpression = (
  opts: EmitterOptions,
  ctx: Context,
  parentStack: Stack,
  parentFieldStack: FieldStack,
  field: FieldAstNode,
): ts.Expression => {
  const stack = pushStackFrame(parentStack, {
    fn: `createFieldNodeExpression`,
    params: { field },
  });
  const fieldStack = pushFieldStack(parentFieldStack, {
    kind: `field`,
    field: field.field,
  });
  if (field.field.widget === `markdown`) {
    const path = createMarkdownAssetPath(ctx, stack, fieldStack);
    const source = field.value;
    if (typeof source !== `string`) {
      pushWarning(ctx, {
        message: `markdown field should be a string`,
        stack,
        details: { field },
      });
      return createNull();
    }
    const markdownAsset: Asset = {
      path,
      source,
    };
    pushMarkdownAsset(ctx, markdownAsset);
    return createLoaderImportExpression(createIdentifier(`loadMarkdown`), path);
  }
  if (field.field.widget === `list`) {
    return createArrayLiteralExpression(
      field.arrayChildren?.map((childFieldNode, index) =>
        createFieldNodeExpression(
          opts,
          ctx,
          stack,
          pushFieldStack(fieldStack, {
            kind: `discriminator`,
            value: `${index}`,
          }),
          childFieldNode,
        ),
      ) ?? [],
    );
  }
  if (field.field.widget === `object`) {
    return createObjectLiteralExpression(
      Object.entries(field.objectChildren ?? {}).reduce(
        (properties, [key, childFieldNode]) => [
          ...properties,
          createPropertyAssignment(
            childFieldNode.field.widget === `markdown`
              ? applyMarkdownPropertyCasing(opts, key)
              : applyPropertyCasing(opts, key),
            createFieldNodeExpression(
              opts,
              ctx,
              stack,
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
  parentStack: Stack,
  content: ContentAstNode,
): ts.Expression => {
  const stack = pushStackFrame(parentStack, {
    fn: `createContentNodeExpression`,
    params: { content },
  });

  return createObjectLiteralExpression([
    createPropertyAssignment(
      `sourceLocation`,
      createStringLiteral(content.sourceLocation),
    ),
    createPropertyAssignment(
      `collection`,
      createStringLiteral(applyPropertyCasing(opts, content.collection.name)),
    ),
    createPropertyAssignment(`slug`, createStringLiteral(content.slug)),
    createPropertyAssignment(
      `locale`,
      content.locale === null
        ? createNull()
        : createStringLiteral(content.locale),
    ),
    createPropertyAssignment(
      `props`,
      createFieldNodeExpression(
        opts,
        ctx,
        stack,
        {
          collection: content.collection,
          slug: content.slug,
          locale: content.locale,
          path: [],
        },
        content.rootFieldNode,
      ),
    ),
    createPropertyAssignment(
      `raw`,
      opts.raw
        ? createNoSubstitutionTemplateLiteral(content.sourceRaw)
        : createNull(),
    ),
  ]);
};

const createCollectionNodeExpressions = (
  opts: EmitterOptions,
  ctx: Context,
  parentStack: Stack,
  collection: CollectionAstNode,
): ts.Expression[] => {
  const stack = pushStackFrame(parentStack, {
    fn: `createCollectionNodeExpression`,
    params: {
      collection,
    },
  });
  return collection.contents.map((content) =>
    createContentNodeExpression(opts, ctx, stack, content),
  );
};

const createContentsExpression = (
  opts: EmitterOptions,
  ctx: Context,
  parentStack: Stack,
  collections: CollectionAstNode[],
): ts.Expression => {
  const stack = pushStackFrame(parentStack, {
    fn: `createCollectionsExpression`,
    params: {
      collections,
    },
  });

  return createAsConstExpression(
    createArrayLiteralExpression(
      collections.flatMap((collection) =>
        createCollectionNodeExpressions(opts, ctx, stack, collection),
      ),
    ),
  );
};

const createIndexTsNodes = (
  opts: EmitterOptions,
  ctx: Context,
  parentStack: Stack,
  collections: CollectionAstNode[],
): ts.Node[] => {
  const stack = pushStackFrame(parentStack, {
    fn: `createIndextsNode`,
    params: { collections },
  });
  const loadMarkdownIdentifier = createIdentifier(`loadMarkdown`);
  const loadMarkdownImportStatement = createImportDeclaration(
    [],
    [],
    createImportClause(false, loadMarkdownIdentifier, undefined),
    createStringLiteral(opts.markdownLoader),
  );

  const contentsIdentifier = createIdentifier(`contents`);
  const contentsDeclarationStatement = createVariableStatement(
    [createModifier(SyntaxKind.ExportKeyword)],
    createVariableDeclarationList(
      [
        createVariableDeclaration(
          contentsIdentifier,
          undefined,
          undefined,
          createContentsExpression(opts, ctx, stack, collections),
        ),
      ],
      NodeFlags.Const,
    ),
  );

  const contentTypeIdentifier = createIdentifier(`Content`);
  const contentTypeDeclaration = createTypeAliasDeclaration(
    [],
    [createModifier(SyntaxKind.ExportKeyword)],
    contentTypeIdentifier,
    undefined,
    createIndexedAccessTypeNode(
      createTypeQueryNode(contentsIdentifier),
      createKeywordTypeNode(SyntaxKind.NumberKeyword),
    ),
  );

  return [
    loadMarkdownImportStatement,
    contentsDeclarationStatement,
    contentTypeDeclaration,
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

const exportRuntimeRawSource = `
export const { findUnique, findAll, match } = createAbstractRuntime(contents);
`;

export const emit = async (
  cwd: string,
  opts: EmitterOptions,
  parseResult: ParseResult,
): Promise<EmitResult> => {
  const ctx: Context = {
    warnings: [],
    markdownAssets: [],
  };
  const stack = pushStackFrame([], { fn: `emit`, params: { parseResult } });
  const indexPath = resolve(cwd, opts.outFolder, `index.ts`);
  const indexTsFile = createSourceFile(indexPath, ``, ScriptTarget.Latest);
  const tsPrinter = createPrinter();

  const printTsNodeStatement = (node: ts.Node): string =>
    `${tsPrinter.printNode(EmitHint.Unspecified, node, indexTsFile)};\n`;

  const indexTsNodes = createIndexTsNodes(
    opts,
    ctx,
    stack,
    parseResult.collections,
  )
    .map(printTsNodeStatement)
    .join(`\n`);

  const runtimeRawSource = await readFile(
    join(__dirname, `..`, `..`, `src`, `lib`, `runtime.ts`),
    { encoding: `utf-8` },
  );

  const indexRawSource = [
    headerRawSource,
    indexTsNodes,
    runtimeRawSource.replace(`export { createAbstractRuntime };`, ``),
    exportRuntimeRawSource,
  ].join(`\n`);

  const indexSource = await formatSource(opts, indexPath, indexRawSource);

  return {
    index: {
      path: indexPath,
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
