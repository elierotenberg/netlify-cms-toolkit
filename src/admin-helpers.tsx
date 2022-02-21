import type NetlifyCmsApp from "netlify-cms-app";
import type {
  EditorComponentField,
  EditorComponentOptions,
} from "netlify-cms-core";
import type { createElement, HTMLAttributes, ReactElement } from "react";

type MdxEditorComponentSpec = {
  readonly id: string;
  readonly label: string;
  readonly tagName: string;
  readonly props: EditorComponentField[];
  readonly children?: EditorComponentField;
};

type RegisterMdxEditorComponent = (spec: MdxEditorComponentSpec) => void;

type InitOptions = {
  readonly CMS: typeof NetlifyCmsApp;
  readonly createElement: typeof createElement;
  readonly uuid: () => string;
  readonly preview: {
    readonly blockProps?: HTMLAttributes<HTMLDivElement>;
  };
};

type CMSHelpers = {
  readonly init: (options: InitOptions) => {
    readonly registerMdxEditorComponent: RegisterMdxEditorComponent;
  };
};

declare global {
  interface Window {
    CMSHelpers: CMSHelpers;
  }
}

if (typeof window.CMSHelpers !== `undefined`) {
  throw new Error(`CMSHelpers already defined`);
}
window.CMSHelpers = {
  init: ({ CMS, createElement, uuid, preview }) => {
    const cleanIndent = (text: string): string =>
      text
        .split(`\n`)
        .map((line) => line.trim())
        .join(`\n`)
        .trim();

    const React = { createElement };

    const mdxBlockBegin =
      /<MdxBlockBegin mdxBlockId='(?<mdxBlockId>.*?)' \/>\s*?/;
    const mdxBlockEnd = /\s*?<MdxBlockEnd mdxBlockId='\k<mdxBlockId>' \/>/;

    const mdxBlock = (pattern: RegExp): RegExp =>
      new RegExp(
        `^${mdxBlockBegin.source}${pattern.source}${mdxBlockEnd.source}$`,
        `ms`,
      );

    const mdxBlockFields = (
      fields: EditorComponentField[],
    ): EditorComponentField[] => [
      {
        name: `mdxBlockId`,
        label: `MdxBlockId`,
        widget: `hidden`,
      },
      ...fields,
    ];

    const castMdxBlockId = (data: unknown): string =>
      typeof data === `string` && data.length > 0 ? data : uuid();

    const fromMdxBlock =
      (fromBlock: (match: RegExpMatchArray) => Record<string, string>) =>
      (match: RegExpMatchArray): Record<string, string> => {
        const mdxBlockId = castMdxBlockId(match?.groups?.mdxBlockId);
        const data = {
          mdxBlockId,
          ...fromBlock(match),
        };
        return data;
      };
    const toMdxBlock =
      (toBlock: (data: Record<string, string>) => string) =>
      (data: Record<string, string>): string => {
        const mdxBlockId = castMdxBlockId(data?.mdxBlockId);

        const block = cleanIndent(`
           <MdxBlockBegin mdxBlockId='${mdxBlockId}' />
             ${toBlock(data)}
           <MdxBlockEnd mdxBlockId='${mdxBlockId}' />
         `);

        return block;
      };

    const SPECIAL_CHARACTERS: [encoded: string, decoded: string][] = [
      [`"`, `&quot;`],
      [`'`, `&apos;`],
      [`<`, `&lt;`],
      [`>`, `&lt;`],
    ];

    const escapeAttribute = (unescapedValue: string): string => {
      return SPECIAL_CHARACTERS.reduce(
        (json, [decoded, encoded]) => json.replaceAll(decoded, encoded),
        unescapedValue.replaceAll(`&`, `&amp;`),
      );
    };

    const unescapeAttribute = (escapedValue: string): string =>
      SPECIAL_CHARACTERS.reduce(
        (json, [decoded, encoded]) => json.replaceAll(encoded, decoded),
        escapedValue,
      ).replaceAll(`&amp;`, `&`);

    const VALID_TAG_NAME = /^([A-Z][a-z0-9]+)+$/;
    const VALID_FIELD_NAME = /^[a-z]+([A-Za-z0-9]+)+$/;

    return {
      registerMdxEditorComponent: ({
        id,
        label,
        props,
        tagName,
        children = {
          name: `children`,
          label: `Children`,
          widget: `hidden`,
        },
      }) => {
        if (!VALID_TAG_NAME.test(tagName)) {
          throw new Error(`Invalid tag name: ${tagName}`);
        }
        for (const field of props) {
          if (!VALID_FIELD_NAME.test(field.name)) {
            throw new Error(`Invalid field name: ${field.name}`);
          }
        }

        const fields = mdxBlockFields([...props, children]);

        const propsParts = props
          .map((field) => `${field.name}='(?<${field.name}>.*?)'`)
          .join(` `);
        const openingTagPart = `<${tagName}${
          propsParts.length > 0 ? ` ${propsParts}` : ``
        }>`;
        const childrenPart = `\\s*?(?<children>.*?)\\s*?`;
        const closingTagPart = `</${tagName}>`;
        const pattern = mdxBlock(
          new RegExp(`${openingTagPart}${childrenPart}${closingTagPart}`),
        );

        const pickProps = (
          data: Record<string, string>,
        ): Record<string, string> => {
          const pickedProps: Record<string, string> = Object.create(null);
          for (const field of props) {
            pickedProps[field.name] = data[field.name];
          }
          return pickedProps;
        };

        const pickChildren = (
          data: Record<string, string>,
        ): undefined | string => {
          return data[children.name];
        };

        const toPreview = (data: Record<string, string>): ReactElement => (
          <div {...preview.blockProps}>
            <div {...preview.blockProps}>
              <em>Props</em>
              <pre>{JSON.stringify(pickProps(data), null, 2)}</pre>
            </div>
            <div {...preview.blockProps}>
              <em>Children</em>
              {pickChildren(data)}
            </div>
          </div>
        );

        CMS.registerEditorComponent({
          id,
          label,
          fields,
          pattern,
          fromBlock: fromMdxBlock((match) => {
            const data = Object.create(null);
            for (const field of props) {
              const value = match?.groups?.[field.name];
              data[field.name] =
                typeof value === `string` && value.length > 0
                  ? unescapeAttribute(value)
                  : ``;
            }
            if (children) {
              const childrenValue = match?.groups?.children;
              data[children.name] =
                typeof childrenValue === `string` && childrenValue.length > 0
                  ? childrenValue
                  : ``;
            }
            return data;
          }),
          toBlock: toMdxBlock((data) => {
            const propsParts = props
              .map((field) => {
                const value = data[field.name];
                return `${field.name}='${escapeAttribute(value ?? ``)}'`;
              })
              .join(` `);
            const openingTagPart = `<${tagName}${
              propsParts.length > 0 ? ` ${propsParts}` : ``
            }>`;
            const childrenPart = children
              ? typeof data[children.name] === `string`
                ? data[children.name]
                : ``
              : ``;
            const closingTagPart = `</${tagName}>`;
            return [openingTagPart, childrenPart, closingTagPart].join(`\n`);
          }),
          toPreview:
            toPreview as unknown as EditorComponentOptions[`toPreview`],
        });
      },
    };
  },
};
