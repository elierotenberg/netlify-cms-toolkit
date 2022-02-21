module.exports = {
  root: true,
  parser: `@typescript-eslint/parser`,
  plugins: [
    `@typescript-eslint/eslint-plugin`,
    `eslint-plugin-import`,
    `eslint-plugin-prettier`,
  ],
  extends: [
    `plugin:@typescript-eslint/recommended`,
    `plugin:react/recommended`,
    `prettier`,
    `plugin:prettier/recommended`,
    `plugin:import/errors`,
    `plugin:import/warnings`,
    `plugin:import/typescript`,
  ],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [`.ts`, `.d.ts`],
    },
    react: {
      version: `detect`,
    },
  },
  parserOptions: {
    ecmaVersion: 2018,
    jsx: true,
    sourceType: `module`,
  },
  rules: {
    "prettier/prettier": [1, { trailingComma: `all`, endOfLine: `auto` }],
    "object-shorthand": [1, `always`],
    quotes: [1, `backtick`],
    "@typescript-eslint/no-unused-vars": [1, { argsIgnorePattern: `^_` }],
    "@typescript-eslint/naming-convention": [
      `error`,
      {
        selector: `variableLike`,
        format: [`strictCamelCase`, `UPPER_CASE`, `PascalCase`, `snake_case`],
        leadingUnderscore: `allow`,
      },
    ],
    "@typescript-eslint/explicit-function-return-type": [
      1,
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
    "import/namespace": 0,
    "import/no-named-as-default": 0,
    "import/no-named-as-default-member": 0,
    "import/default": 0,
    "import/order": [
      1,
      {
        groups: [
          `builtin`,
          `external`,
          `internal`,
          `parent`,
          `sibling`,
          `index`,
        ],
        "newlines-between": `always`,
      },
    ],
    "react-hooks/exhaustive-deps": 0,
    // until https://github.com/yannickcr/eslint-plugin-react/issues/2654 is resolved
    "react/display-name": 0,

    "react/prop-types": 0,
    "react/react-in-jsx-scope": 1,
  },
};
