import { ts } from "ts-morph";

import {
  Field,
  FilesCollection,
  FilesCollectionI18n,
  FilesCollectionItem,
  FolderCollectionI18n,
  FolderTaggedCollection,
  ListField,
  ObjectField,
  RelationField,
  Schema,
  SelectField,
  SelectFieldOption,
  tagCollection,
} from "./Schema";

const {
  createArrayTypeNode,
  createComputedPropertyName,
  createIdentifier,
  createImportClause,
  createImportDeclaration,
  createImportSpecifier,
  createIndexedAccessTypeNode,
  createKeywordTypeNode,
  createLiteralTypeNode,
  createModifier,
  createNamedImports,
  createNull,
  createPropertySignature,
  createStringLiteral,
  createToken,
  createTypeAliasDeclaration,
  createTypeLiteralNode,
  createTypeReferenceNode,
  createUnionTypeNode,
} = ts.factory;

const { SyntaxKind } = ts;

type TypeEmitterOptions = {
  readonly markdownTypeModule: string;
  readonly markdownTypeIdentifier: string;
  readonly raw?: boolean;
  readonly sourceLocation?: boolean;
};

const createFieldsTypeNode = (
  opts: TypeEmitterOptions,
  fields: Field[],
): ts.TypeNode =>
  createTypeLiteralNode(
    fields.reduce<ts.TypeElement[]>(
      (typeElements, field) => [
        ...typeElements,
        createPropertySignature(
          [],
          field.name,
          field.required === false
            ? createToken(SyntaxKind.QuestionToken)
            : undefined,
          createRequiredFieldTypeNode(opts, field),
        ),
      ],
      [],
    ),
  );

const createCodeFieldTypeNode = (): ts.TypeNode =>
  createTypeLiteralNode([
    createPropertySignature(
      [],
      `code`,
      undefined,
      createKeywordTypeNode(SyntaxKind.StringKeyword),
    ),
    createPropertySignature(
      [],
      `lang`,
      createToken(SyntaxKind.QuestionToken),
      createKeywordTypeNode(SyntaxKind.StringKeyword),
    ),
  ]);

const createListFieldTypeNode = (
  opts: TypeEmitterOptions,
  field: ListField,
): ts.TypeNode => {
  if (field.fields) {
    return createArrayTypeNode(createFieldsTypeNode(opts, field.fields));
  }

  return createArrayTypeNode(createKeywordTypeNode(SyntaxKind.StringKeyword));
};

const createObjectFieldTypeNode = (
  opts: TypeEmitterOptions,
  field: ObjectField,
): ts.TypeNode => createFieldsTypeNode(opts, field.fields);

const createRelationFieldTypeNode = (field: RelationField): ts.TypeNode => {
  if (field.multiple) {
    return createArrayTypeNode(createKeywordTypeNode(SyntaxKind.StringKeyword));
  }

  return createKeywordTypeNode(SyntaxKind.StringKeyword);
};

const createSelectFieldOptionTypeNode = (
  option: SelectFieldOption,
): ts.TypeNode => {
  if (typeof option === `string`) {
    return createLiteralTypeNode(createStringLiteral(option));
  }
  return createLiteralTypeNode(createStringLiteral(option.value));
};

const createSelectFieldTypeNode = (field: SelectField): ts.TypeNode => {
  const optionUnionTypeNode = createUnionTypeNode(
    field.options.map(createSelectFieldOptionTypeNode),
  );

  if (field.multiple) {
    return createArrayTypeNode(optionUnionTypeNode);
  }

  return optionUnionTypeNode;
};

const createRequiredFieldTypeNode = (
  opts: TypeEmitterOptions,
  field: Field,
): ts.TypeNode => {
  if (field.widget === `boolean`) {
    return createKeywordTypeNode(SyntaxKind.BooleanKeyword);
  }

  if (field.widget === `code`) {
    return createCodeFieldTypeNode();
  }

  if (field.widget === `color`) {
    return createKeywordTypeNode(SyntaxKind.StringKeyword);
  }

  if (field.widget === `datetime`) {
    return createTypeReferenceNode(`Date`);
  }

  if (field.widget === `file`) {
    return createKeywordTypeNode(SyntaxKind.StringKeyword);
  }

  if (field.widget === `hidden`) {
    return createKeywordTypeNode(SyntaxKind.UnknownKeyword);
  }

  if (field.widget === `image`) {
    return createKeywordTypeNode(SyntaxKind.StringKeyword);
  }

  if (field.widget === `list`) {
    return createListFieldTypeNode(opts, field);
  }

  if (field.widget === `map`) {
    return createKeywordTypeNode(SyntaxKind.StringKeyword);
  }

  if (field.widget === `markdown`) {
    return createTypeReferenceNode(`Markdown`);
  }

  if (field.widget === `number`) {
    return createKeywordTypeNode(SyntaxKind.NumberKeyword);
  }

  if (field.widget === `object`) {
    return createObjectFieldTypeNode(opts, field);
  }

  if (field.widget === `relation`) {
    return createRelationFieldTypeNode(field);
  }

  if (field.widget === `select`) {
    return createSelectFieldTypeNode(field);
  }

  if (field.widget === `string`) {
    return createKeywordTypeNode(SyntaxKind.StringKeyword);
  }

  if (field.widget === `text`) {
    return createKeywordTypeNode(SyntaxKind.StringKeyword);
  }

  return createKeywordTypeNode(SyntaxKind.UnknownKeyword);
};

const createLocaleTypeNode = (locales: string[]): ts.TypeNode =>
  createUnionTypeNode(
    locales.map((locale) => createLiteralTypeNode(createStringLiteral(locale))),
  );

const createCollectionTypeNode = (
  opts: TypeEmitterOptions,
  {
    collection,
    file,
    kind,
    i18n,
    fields,
  }: {
    readonly collection: string;
    readonly file?: string;
    readonly kind: string;
    readonly i18n?: FolderCollectionI18n | FilesCollectionI18n;
    readonly fields: Field[];
  },
): ts.TypeNode => {
  const properties: [key: string, type: ts.TypeNode][] = [
    [`collection`, createLiteralTypeNode(createStringLiteral(collection))],
    [`kind`, createLiteralTypeNode(createStringLiteral(kind))],
    [`slug`, createKeywordTypeNode(SyntaxKind.StringKeyword)],
    [
      `locale`,
      i18n
        ? createIndexedAccessTypeNode(
            createTypeReferenceNode(`Schema`),
            createLiteralTypeNode(createStringLiteral(`locale`)),
          )
        : createLiteralTypeNode(createNull()),
    ],
    [`props`, createFieldsTypeNode(opts, fields)],
  ];

  if (file) {
    properties.unshift([
      `file`,
      createLiteralTypeNode(createStringLiteral(file)),
    ]);
  }

  if (opts.raw) {
    properties.push([`raw`, createKeywordTypeNode(SyntaxKind.StringKeyword)]);
  }

  if (opts.sourceLocation) {
    properties.push([
      `sourceLocation`,
      createKeywordTypeNode(SyntaxKind.StringKeyword),
    ]);
  }

  return createTypeLiteralNode(
    properties.map(([key, node]) =>
      createPropertySignature([], key, undefined, node),
    ),
  );
};

const createFolderCollectionTypeNode = (
  opts: TypeEmitterOptions,
  collection: FolderTaggedCollection,
): ts.TypeNode =>
  createCollectionTypeNode(opts, {
    collection: collection.name,
    kind: `folder`,
    fields: collection.fields,
    i18n: collection.i18n,
  });

const createFilesCollectionItemTypeNode = (
  opts: TypeEmitterOptions,
  collection: FilesCollection,
  item: FilesCollectionItem,
): ts.TypeNode => {
  return createCollectionTypeNode(opts, {
    collection: collection.name,
    kind: `files`,
    fields: item.fields,
    file: item.name,
    i18n: item.i18n,
  });
};

const createSchemaTypeNode = (
  opts: TypeEmitterOptions,
  schema: Schema,
): ts.TypeNode =>
  createTypeLiteralNode([
    createPropertySignature(
      [],
      `locale`,
      undefined,
      schema.i18n
        ? createLocaleTypeNode(schema.i18n.locales)
        : createKeywordTypeNode(SyntaxKind.NeverKeyword),
    ),
    createPropertySignature(
      [],
      `collection`,
      undefined,
      createTypeLiteralNode(
        schema.collections
          .map(tagCollection)
          .map((collection) =>
            createPropertySignature(
              [],
              createComputedPropertyName(createStringLiteral(collection.name)),
              undefined,
              collection.kind === `folder`
                ? createFolderCollectionTypeNode(opts, collection)
                : createTypeLiteralNode(
                    collection.files.map((item) =>
                      createPropertySignature(
                        [],
                        createComputedPropertyName(
                          createStringLiteral(item.name),
                        ),
                        undefined,
                        createFilesCollectionItemTypeNode(
                          opts,
                          collection,
                          item,
                        ),
                      ),
                    ),
                  ),
            ),
          ),
      ),
    ),
  ]);

export const createSchemaTypeAliasDeclaration = (
  opts: TypeEmitterOptions,
  schema: Schema,
): ts.TypeAliasDeclaration =>
  createTypeAliasDeclaration(
    [],
    [createModifier(SyntaxKind.ExportKeyword)],
    `Schema`,
    [],
    createSchemaTypeNode(opts, schema),
  );

const createContentsTypeNode = (schema: Schema): ts.TypeNode =>
  createTypeReferenceNode(`Readonly`, [
    createTypeLiteralNode(
      schema.collections
        .map(tagCollection)
        .map((collection): ts.PropertySignature => {
          if (collection.kind === `folder`) {
            return createPropertySignature(
              [],
              createComputedPropertyName(createStringLiteral(collection.name)),
              undefined,
              createArrayTypeNode(
                createIndexedAccessTypeNode(
                  createIndexedAccessTypeNode(
                    createTypeReferenceNode(`Schema`),
                    createLiteralTypeNode(createStringLiteral(`collection`)),
                  ),
                  createLiteralTypeNode(createStringLiteral(collection.name)),
                ),
              ),
            );
          }
          return createPropertySignature(
            [],
            createComputedPropertyName(createStringLiteral(collection.name)),
            undefined,
            createTypeLiteralNode(
              collection.files.map(
                (item): ts.PropertySignature =>
                  createPropertySignature(
                    [],
                    createComputedPropertyName(createStringLiteral(item.name)),
                    undefined,
                    createArrayTypeNode(
                      createIndexedAccessTypeNode(
                        createIndexedAccessTypeNode(
                          createIndexedAccessTypeNode(
                            createTypeReferenceNode(`Schema`),
                            createLiteralTypeNode(
                              createStringLiteral(`collection`),
                            ),
                          ),
                          createLiteralTypeNode(
                            createStringLiteral(collection.name),
                          ),
                        ),
                        createLiteralTypeNode(createStringLiteral(item.name)),
                      ),
                    ),
                  ),
              ),
            ),
          );
        }),
    ),
  ]);

export const createContentsTypeAliasDeclaration = (
  schema: Schema,
): ts.TypeAliasDeclaration =>
  createTypeAliasDeclaration(
    [],
    [createModifier(SyntaxKind.ExportKeyword)],
    `Contents`,
    [],
    createContentsTypeNode(schema),
  );

export const createMarkdownTypeImportDeclaration = (
  opts: TypeEmitterOptions,
): ts.ImportDeclaration =>
  createImportDeclaration(
    [],
    [],
    createImportClause(
      true,
      undefined,
      createNamedImports([
        createImportSpecifier(
          false,
          createIdentifier(opts.markdownTypeIdentifier),
          createIdentifier(`Markdown`),
        ),
      ]),
    ),
    createStringLiteral(opts.markdownTypeModule),
  );
