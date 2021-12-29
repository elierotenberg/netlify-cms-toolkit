# `netlify-cms-toolkit`

This toolkit supercharges Netlify CMS with better developer experience.

Currently only one tool is available: the compiler.

## Install

`npm i netlify-cms-toolkit`

## The compiler

The compiler turns your `config.yml` and content files (`.md`, `.yml`...) into a statically typed, dynamic-import friendly flat-file structure.

What you get:

- a statically typed index file in TypeScript (see [example](src/__tests__/fixtures/out/index.ts)),
- splitted assets for each markdown field friendly to dynamic import, including collections with `single_file` i18n (see [examples](src/__tests__/fixtures/out/assets)),
- a statically typed runtime to use your contents type-safely in your app (see [example](src/__tests__/runtime.test.ts)).

The compiler is completely agnostic of your site generator, but it has been designed with NextJS in mind.

### Using the compiler

```
> npx netlify-cms-toolkit compile

Compile contents and generate index file

Options:
      --version                 Show version number                    [boolean]
      --config                  Path to JSON config file
      --help                    Show help                              [boolean]
      --cwd                     Working directory (defaults to proces.cwd)
                                                                       [boolean]
  -i, --schema                  Netlify config file (config.yml)
                                                             [string] [required]
  -o, --outFolder               Output folder                [string] [required]
      --saveParseResult         Save intermediate parse results
                                                      [boolean] [default: false]
      --saveEmitResult          Save intermediate emit results
                                                      [boolean] [default: false]
      --useLockfile             Use lock file to avoid write conflicts
                                                       [boolean] [default: true]
  -r, --raw                     Include raw contents  [boolean] [default: false]
      --markdownLoader          Loader module (e.g. 'next/dynamic')
                                                             [string] [required]
      --eslintConfig            Custom eslint config fig (e.g. .eslintrc.js)
                                                                        [string]
      --markdownPropertyCasing  Casing convention for markdown property naming
         [choices: "preserve", "camelCase", "pascalCase", "snakeCase"] [default:
                                                                     "preserve"]
      --propertyCasing          Casing convention for non-markdown property
                                naming
                   [choices: "preserve", "camelCase", "pascalCase", "snakeCase"]
  -w, --watch                   Recompile on changes  [boolean] [default: false]
      --exitOnError             Exit on error in watch mode
                                                       [boolean] [default: true]
  -s, --silent                  Suppress console output
                                                      [boolean] [default: false]
      --dryRun                  Dry run (don't write output files)
                                                      [boolean] [default: false]
```

You can provide a configuration file (see [example](netlify-cms-toolkit-compiler.json.json)).

### Power of static typing

Compiled `index.ts` provides a very robust and safe framework for working with contents.

For example, you can create a `BlogPost` React component that will render contents from a folder collection:

```tsx
import { contents, Content, findAll, findUnique } from "contents/out";

type BlogPostContent = Extract<Content, { collection: "blog_posts" }>;

const { findUnique } = createRuntime(contents);

const BlogPost: FunctionComponent<{ slug: BlogPostContent["slug"] }> = ({
  slug,
}) => {
  const blogPost = findUnique({
    collection: "blog_posts",
    slug,
  });

  return (
    <div>
      <blogPost.Body /> {/* <== type safe */}
    </div>
  );
};
```

### Watch mode

Compiler can be used in watch mode, i.e. watch your schema and contents and recompile on change.

This is especially useful in dev mode with hot reloading. For example, if you are using NextJS, then you can add the following to your `package.json`:

```json
{
  "scripts": {
    "next:dev": "next dev",
    "netlify-cms:proxy": "netlify-cms-proxy-server",
    "netlify-cms:watch": "netlify-cms-toolkit compile --config netlify-cms-toolkit-compiler.config.json",
    "dev": "concurrently 'npm run next:dev' 'npm run netlify-cms:proxy' 'npm run netlify-cms:watch'"
  }
}
```
