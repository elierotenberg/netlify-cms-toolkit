import {
  z,
  ZodArray,
  ZodNumber,
  ZodRawShape,
  ZodSchema,
  ZodTypeAny,
} from "zod";

import {
  Field,
  ListField,
  NumberField,
  ObjectField,
  RelationField,
  SelectField,
  SelectFieldOption,
} from "./Schema";
import { Serializable } from "./Serializer";
import { memoize } from "./util";

export const BooleanFieldValue = z.boolean({
  invalid_type_error: `Boolean Field`,
});

export const CodeFieldValue = z.object(
  {
    code: z.string(),
    lang: z.string().optional(),
  },
  {
    invalid_type_error: `Code Field`,
  },
);

export const ColorFieldValue = z.string({
  invalid_type_error: `Color Field`,
});

export const DateTimeFieldValue = z.date({
  invalid_type_error: `DateTime Field`,
});

export const FileFieldValue = z.string({
  invalid_type_error: `File Field`,
});

export const HiddenFieldValue = Serializable;

export const ImageFieldValue = z.string({ invalid_type_error: `Image Field` });

export const StringListFieldValue = z.array(z.string(), {
  invalid_type_error: `String List Field`,
});

export const RecordListFieldValue = z.array(Serializable, {
  invalid_type_error: `Record List Field`,
});

export const ListFieldValue = z.union(
  [StringListFieldValue, RecordListFieldValue],
  { invalid_type_error: `List Field` },
);

export const MapFieldValue = z.string({ invalid_type_error: `Map Field` });

export const MarkdownFieldValue = z.string({
  invalid_type_error: `Markdown Field`,
});

const IntNumberFieldValue = z.number().int({ message: `Int Number Field` });

export const FloatNumberFieldValue = z.string({
  invalid_type_error: `Float Number Field`,
});

export const NumberFieldValue = z.union(
  [IntNumberFieldValue, FloatNumberFieldValue],
  { invalid_type_error: `Number Field` },
);

export const ObjectFieldValue = z.record(Serializable, {
  invalid_type_error: `Object Field`,
});

const SingleRelationFieldValue = z.string({
  invalid_type_error: `Single Relation Field`,
});

const MultipleRelationFieldValue = z.array(z.string(), {
  invalid_type_error: `Multiple Relation Field`,
});

export const RelationFieldValue = z.union(
  [SingleRelationFieldValue, MultipleRelationFieldValue],
  { invalid_type_error: `Relation Field Value` },
);

const SingleSelectFieldValue = z.string({
  invalid_type_error: `Single Select Field`,
});

const MultipleSelectFieldValue = z.array(z.string(), {
  invalid_type_error: `Multiple Select Field`,
});

export const SelectFieldValue = z.union(
  [SingleSelectFieldValue, MultipleSelectFieldValue],
  { invalid_type_error: `Select Field` },
);

export const StringFieldValue = z.string({
  invalid_type_error: `String Field`,
});

export const TextFieldValue = z.string({ invalid_type_error: `Text Field` });

const RequiredFieldValue = z.union(
  [
    BooleanFieldValue,
    CodeFieldValue,
    ColorFieldValue,
    DateTimeFieldValue,
    FileFieldValue,
    HiddenFieldValue,
    ImageFieldValue,
    ListFieldValue,
    MapFieldValue,
    MarkdownFieldValue,
    NumberFieldValue,
    ObjectFieldValue,
    RelationFieldValue,
    SelectFieldValue,
    StringFieldValue,
    TextFieldValue,
  ],
  { invalid_type_error: `Required Field` },
);
type RequiredFieldValue = z.infer<typeof RequiredFieldValue>;

export const FieldValue = RequiredFieldValue.optional();
export type FieldValue = z.infer<typeof FieldValue>;

type ZodSchemaFor<T extends ZodTypeAny> = ZodSchema<z.infer<T>>;

const refineZodArrayMinMax = <T extends ZodTypeAny>(
  schema: ZodArray<T>,
  { min, max }: { min?: number; max?: number },
): ZodArray<T> => {
  let refinedSchema = schema;
  if (typeof min !== `undefined`) {
    refinedSchema = refinedSchema.min(min);
  }
  if (typeof max !== `undefined`) {
    refinedSchema = refinedSchema.max(max);
  }

  return refinedSchema;
};

export const createFieldsSchema = (
  fields: Field[],
): ZodSchema<Record<string, FieldValue>> =>
  z.object(
    fields.reduce<ZodRawShape>(
      (shape, field) => ({
        ...shape,
        [field.name]: createFieldSchema(field),
      }),
      {},
    ),
    {
      invalid_type_error: `Fields`,
    },
  );

const createListFieldSchema = (
  field: ListField,
): ZodSchemaFor<typeof ListFieldValue> => {
  if (typeof field.fields !== `undefined`) {
    return refineZodArrayMinMax(
      z.array(
        z.object(
          field.fields.reduce<ZodRawShape>(
            (shape, field) => ({
              ...shape,
              [field.name]: createFieldSchema(field),
            }),
            {},
          ),
          { invalid_type_error: `List Field Object` },
        ),
        { invalid_type_error: `List Field Array` },
      ),
      field,
    );
  }
  return refineZodArrayMinMax(StringListFieldValue, field);
};

const createNumberFieldSchema = (
  field: NumberField,
): ZodSchemaFor<typeof NumberFieldValue> => {
  const { min, max } = field;
  if (field.value_type === `float`) {
    let schema: ZodSchema<string> = FloatNumberFieldValue;
    if (min !== undefined) {
      schema = schema.refine((stringValue) => {
        const numberValue = parseFloat(stringValue);
        return numberValue > min;
      });
    }
    if (max !== undefined) {
      schema = schema.refine((stringValue) => {
        const numberValue = parseFloat(stringValue);
        return numberValue < max;
      });
    }

    return schema;
  }

  let schema: ZodNumber = IntNumberFieldValue;

  if (min !== undefined) {
    schema = schema.gte(min);
  }

  if (max !== undefined) {
    schema = schema.lte(max);
  }

  return schema;
};

const createObjectFieldSchema = (
  field: ObjectField,
): ZodSchemaFor<typeof ObjectFieldValue> => createFieldsSchema(field.fields);

const createRelationFieldSchema = (
  field: RelationField,
): ZodSchemaFor<typeof RelationFieldValue> => {
  if (field.multiple) {
    const { min, max } = field;
    let schema = MultipleRelationFieldValue;

    if (min !== undefined) {
      schema = schema.min(min);
    }

    if (max !== undefined) {
      schema = schema.max(max);
    }

    return schema;
  }

  return SingleRelationFieldValue;
};

const createSelectFieldOptionSchema = (
  option: SelectFieldOption,
): ZodSchema<string> => {
  if (typeof option === `string`) {
    return z.literal(option, {
      invalid_type_error: `String Select Field Option`,
    });
  }

  return z.literal(option.value, {
    invalid_type_error: `Key-Value Select Field Option`,
  });
};

const createSingleSelectFieldSchema = (
  field: SelectField,
): ZodSchemaFor<typeof SingleSelectFieldValue> => {
  if (field.options.length === 1) {
    return createSelectFieldOptionSchema(field.options[0]);
  }

  const [option1, option2, ...tailOptions] = field.options;

  return z.union(
    [
      createSelectFieldOptionSchema(option1),
      createSelectFieldOptionSchema(option2),
      ...tailOptions.reduce<ZodSchema<string>[]>(
        (tailOptions, option) => [
          ...tailOptions,
          createSelectFieldOptionSchema(option),
        ],
        [],
      ),
    ],
    { invalid_type_error: `Single Select Field Union` },
  );
};

const createSelectFieldSchema = (
  field: SelectField,
): ZodSchemaFor<typeof SelectFieldValue> => {
  const singleSelectFieldSchema = createSingleSelectFieldSchema(field);

  if (field.multiple) {
    return refineZodArrayMinMax(
      z.array(singleSelectFieldSchema, {
        invalid_type_error: `Multiple Select Field Array`,
      }),
      field,
    );
  }

  return singleSelectFieldSchema;
};

const createRequiredFieldSchema = memoize(
  (field: Field): ZodSchemaFor<typeof RequiredFieldValue> => {
    if (field.widget === `boolean`) {
      return BooleanFieldValue;
    }

    if (field.widget === `code`) {
      return CodeFieldValue;
    }

    if (field.widget === `color`) {
      return ColorFieldValue;
    }

    if (field.widget === `datetime`) {
      return DateTimeFieldValue;
    }

    if (field.widget === `file`) {
      return FileFieldValue;
    }

    if (field.widget === `hidden`) {
      return HiddenFieldValue;
    }

    if (field.widget === `image`) {
      return ImageFieldValue;
    }

    if (field.widget === `list`) {
      return createListFieldSchema(field);
    }

    if (field.widget === `map`) {
      return MapFieldValue;
    }

    if (field.widget === `markdown`) {
      return MarkdownFieldValue;
    }

    if (field.widget === `number`) {
      return createNumberFieldSchema(field);
    }

    if (field.widget === `object`) {
      return createObjectFieldSchema(field);
    }

    if (field.widget === `relation`) {
      return createRelationFieldSchema(field);
    }

    if (field.widget === `select`) {
      return createSelectFieldSchema(field);
    }

    if (field.widget === `string`) {
      return StringFieldValue;
    }

    if (field.widget === `text`) {
      return TextFieldValue;
    }

    throw new TypeError(`Unknown field widget (never)`);
  },
);

export const createFieldSchema = memoize(
  (field: Field): ZodSchemaFor<typeof FieldValue> => {
    const fieldSchema = createRequiredFieldSchema(field);

    if (field.required === false) {
      return fieldSchema.optional();
    }

    return fieldSchema;
  },
);
