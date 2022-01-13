/**
 *
 * Experimental Zod schema emitter.
 * Currently not used, but could be in the future.
 *
 */

export {};

// import { ts } from "ts-morph";
// import { z } from "zod";

// import {
//   Field,
//   ListField,
//   NumberField,
//   ObjectField,
//   SelectField,
//   TaggedCollection,
// } from "./Schema";

// const {
//   createIdentifier,
//   createImportDeclaration,
//   createImportClause,
//   createNamedImports,
//   createImportSpecifier,
//   createStringLiteral,
//   createCallExpression,
//   createPropertyAccessExpression,
//   createObjectLiteralExpression,
//   createPropertyAssignment,
//   createNumericLiteral,
//   createArrowFunction,
//   createBinaryExpression,
//   createToken,
//   createParameterDeclaration,
//   createArrayLiteralExpression,
// } = ts.factory;

// const { SyntaxKind } = ts;

// export const createZodImportDeclaration = (): ts.ImportDeclaration =>
//   createImportDeclaration(
//     [],
//     [],
//     createImportClause(
//       false,
//       undefined,
//       createNamedImports([
//         createImportSpecifier(false, undefined, createIdentifier(`z`)),
//       ]),
//     ),
//     createStringLiteral(`zod`),
//   );

// type ZodProperty = keyof typeof z;

// const createMaybeZodOptionalExpression = (
//   expression: ts.Expression,
//   required = false,
// ): ts.Expression =>
//   required
//     ? expression
//     : createCallExpression(
//         createPropertyAccessExpression(expression, `optional`),
//         undefined,
//         [],
//       );

// const createZodPropertyExpression = (property: ZodProperty): ts.Expression =>
//   createCallExpression(
//     createPropertyAccessExpression(createStringLiteral(`z`), property),
//     undefined,
//     [],
//   );

// const createZodArrayExpression = (
//   expression: ts.Expression,
//   {
//     min = undefined,
//     max = undefined,
//   }: { readonly min?: number; readonly max?: number },
// ): ts.Expression => {
//   let arrayExpression = createCallExpression(
//     createPropertyAccessExpression(createIdentifier(`z`), `array`),
//     [],
//     [expression],
//   );

//   if (min !== undefined) {
//     arrayExpression = createCallExpression(
//       createPropertyAccessExpression(arrayExpression, `min`),
//       [],
//       [createNumericLiteral(min)],
//     );
//   }
//   if (max !== undefined) {
//     arrayExpression = createCallExpression(
//       createPropertyAccessExpression(arrayExpression, `max`),
//       [],
//       [createNumericLiteral(max)],
//     );
//   }

//   return arrayExpression;
// };

// const createZodLiteralExpression = (value: ts.Expression): ts.Expression =>
//   createCallExpression(
//     createPropertyAccessExpression(createIdentifier(`z`), `literal`),
//     [],
//     [value],
//   );

// const createListFieldZodExpression = (field: ListField): ts.Expression =>
//   createMaybeZodOptionalExpression(
//     createZodArrayExpression(
//       field.field
//         ? createMaybeZodOptionalExpression(
//             createFieldZodExpression(field.field),
//             field.required,
//           )
//         : field.fields
//         ? createObjectLiteralExpression(
//             field.fields.map((field) =>
//               createPropertyAssignment(
//                 field.name,
//                 createMaybeZodOptionalExpression(
//                   createFieldZodExpression(field),
//                   field.required,
//                 ),
//               ),
//             ),
//           )
//         : createZodPropertyExpression(`string`),
//       { min: field.min, max: field.max },
//     ),
//     field.required,
//   );

// const createNumberFieldZodExpression = (field: NumberField): ts.Expression => {
//   if (field.value_type === `float`) {
//     let stringExpression = createZodPropertyExpression(`string`);

//     if (field.min !== undefined) {
//       stringExpression = createCallExpression(
//         createPropertyAccessExpression(stringExpression, `refine`),
//         [],
//         [
//           createArrowFunction(
//             [],
//             [],
//             [
//               createParameterDeclaration(
//                 [],
//                 undefined,
//                 undefined,
//                 createIdentifier(`value`),
//                 undefined,
//                 undefined,
//                 undefined,
//               ),
//             ],
//             undefined,
//             createToken(SyntaxKind.EqualsGreaterThanToken),
//             createBinaryExpression(
//               createCallExpression(
//                 createIdentifier(`parseFloat`),
//                 [],
//                 [createIdentifier(`value`)],
//               ),
//               createToken(SyntaxKind.GreaterThanEqualsToken),
//               createNumericLiteral(field.min),
//             ),
//           ),
//         ],
//       );
//     }

//     if (field.max !== undefined) {
//       stringExpression = createCallExpression(
//         createPropertyAccessExpression(stringExpression, `refine`),
//         [],
//         [
//           createArrowFunction(
//             [],
//             [],
//             [
//               createParameterDeclaration(
//                 [],
//                 undefined,
//                 undefined,
//                 createIdentifier(`value`),
//                 undefined,
//                 undefined,
//                 undefined,
//               ),
//             ],
//             undefined,
//             createToken(SyntaxKind.EqualsGreaterThanToken),
//             createBinaryExpression(
//               createCallExpression(
//                 createIdentifier(`parseFloat`),
//                 [],
//                 [createIdentifier(`value`)],
//               ),
//               createToken(SyntaxKind.LessThanEqualsToken),
//               createNumericLiteral(field.max),
//             ),
//           ),
//         ],
//       );
//     }

//     return createMaybeZodOptionalExpression(stringExpression, field.required);
//   }

//   let intExpression = createCallExpression(
//     createPropertyAccessExpression(
//       createZodPropertyExpression(`number`),
//       `int`,
//     ),
//     [],
//     [],
//   );

//   if (field.min !== undefined) {
//     intExpression = createCallExpression(
//       createPropertyAccessExpression(intExpression, `min`),
//       [],
//       [createNumericLiteral(field.min)],
//     );
//   }

//   if (field.max !== undefined) {
//     intExpression = createCallExpression(
//       createPropertyAccessExpression(intExpression, `max`),
//       [],
//       [createNumericLiteral(field.max)],
//     );
//   }

//   return createMaybeZodOptionalExpression(intExpression, field.required);
// };

// const createObjectFieldZodExpression = (field: ObjectField): ts.Expression =>
//   createMaybeZodOptionalExpression(
//     createObjectLiteralExpression(
//       field.fields.map((field) =>
//         createPropertyAssignment(
//           field.name,
//           createMaybeZodOptionalExpression(
//             createFieldZodExpression(field),
//             field.required,
//           ),
//         ),
//       ),
//     ),
//     field.required,
//   );

// const createSelectFieldZodExpression = (field: SelectField): ts.Expression => {
//   const valuesUnionExpression = createCallExpression(
//     createPropertyAccessExpression(createIdentifier(`z`), `union`),
//     [],
//     [
//       createArrayLiteralExpression(
//         field.options.map((option) =>
//           createZodLiteralExpression(
//             typeof option === `string`
//               ? createStringLiteral(option)
//               : createStringLiteral(option.value),
//           ),
//         ),
//       ),
//     ],
//   );

//   if (field.multiple) {
//     return createMaybeZodOptionalExpression(
//       createZodArrayExpression(valuesUnionExpression, {
//         min: field.min,
//         max: field.max,
//       }),
//       field.required,
//     );
//   }

//   return createMaybeZodOptionalExpression(
//     valuesUnionExpression,
//     field.required,
//   );
// };

// const createFieldZodExpression = (field: Field): ts.Expression => {
//   if (field.widget === `boolean`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`boolean`),
//       field.required,
//     );
//   }

//   if (field.widget === `code`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   if (field.widget === `color`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   if (field.widget === `datetime`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`date`),
//       field.required,
//     );
//   }

//   if (field.widget === `file`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   if (field.widget == `hidden`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`unknown`),
//       field.required,
//     );
//   }

//   if (field.widget === `image`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   if (field.widget === `list`) {
//     return createListFieldZodExpression(field);
//   }

//   if (field.widget === `map`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   if (field.widget === `markdown`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   if (field.widget === `number`) {
//     return createNumberFieldZodExpression(field);
//   }

//   if (field.widget === `object`) {
//     return createObjectFieldZodExpression(field);
//   }

//   if (field.widget === `relation`) {
//     if (field.multiple) {
//       return createMaybeZodOptionalExpression(
//         createZodArrayExpression(createZodPropertyExpression(`string`), {
//           min: field.min,
//           max: field.max,
//         }),
//       );
//     }

//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   if (field.widget === `select`) {
//     return createSelectFieldZodExpression(field);
//   }

//   if (field.widget === `string`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   if (field.widget === `text`) {
//     return createMaybeZodOptionalExpression(
//       createZodPropertyExpression(`string`),
//       field.required,
//     );
//   }

//   return createMaybeZodOptionalExpression(
//     createZodPropertyExpression(`unknown`),
//     false,
//   );
// };

// const createCollectionContentPropsZodExpression = (): ts.Expression => {};

// const createCollectionContentZodExpression = (
//   collection: TaggedCollection,
// ): ts.Expression => {};
