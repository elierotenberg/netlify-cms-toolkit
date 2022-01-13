# `netlify-cms-toolkit`

This toolkit supercharges Netlify CMS with better developer experience.

Currently only one tool is available: the compiler.

## Install

`npm i netlify-cms-toolkit`

## The compiler

The compiler turns your `config.yml` and content files (`.md`, `.yml`...) into a statically typed, dynamic-import friendly flat-file structure.

What you get:

- a statically typed index file in TypeScript (see [example](src/__tests__/fixtures/out/assets/index.ts)),
- splitted assets for each markdown field friendly to dynamic import, including collections with `single_file` i18n (see [examples](src/__tests__/fixtures/out/assets)),
- a statically schema your contents type-safely in your app.

The compiler is completely agnostic of your site generator, but it has been designed with NextJS in mind.

### Using the compiler

```
> npx netlify-cms-toolkit compile

Compile contents and generate index file

Options:
      --version                   Show version number                  [boolean]
      --config                    Path to JSON config file
      --help                      Show help                            [boolean]
      --cwd                       Working directory (defaults to proces.cwd)
                [string] [default: "/home/elierotenberg/gh/netlify-cms-toolkit"]
      --dryRun                    Dry run (don't write output files)
                                                      [boolean] [default: false]
      --eslintConfig              Custom eslint config fig (e.g. .eslintrc.js)
                                                                        [string]
      --exitOnError               Exit on error in watch mode
                                                       [boolean] [default: true]
      --markdownLoaderIdentifier  Markdown loader identifier within markdown
                                  loader module (e.g. 'default' or 'load')
                                                             [string] [required]
      --markdownLoaderModule      Markdown loader module (e.g. 'next/dynamic' or
                                  '../markdown-loader')      [string] [required]
      --markdownTypeIdentifier    Markdown type identifier within markdown type
                                  module (e.g. 'default' or 'MDXContent')
                                                             [string] [required]
      --markdownTypeModule        Markdown type module (e.g. '*.mdx' or
                                  '../markdown-content')     [string] [required]
  -o, --outFolder                 Output folder              [string] [required]
  -r, --raw                       Include raw contents[boolean] [default: false]
      --saveParseResult           Save intermediate parse results
                                                      [boolean] [default: false]
      --saveEmitResult            Save intermediate emit results
                                                      [boolean] [default: false]
  -i, --schema                    Netlify config file (config.yml)
                                                             [string] [required]
  -s, --silent                    Suppress console output
                                                      [boolean] [default: false]
      --sourceLocation            Include source location in output
                                                      [boolean] [default: false]
      --useLockfile               Use lock file to avoid write conflicts
                                                       [boolean] [default: true]
  -w, --watch                     Recompile on changes[boolean] [default: false]
```

You can provide a configuration file (see [example](netlify-cms-toolkit-compiler.json.json)).

### Power of static typing

Compiled `index.ts` provides a very robust and safe framework for working with contents.

For example, you can create a `BlogPost` React component that will render contents from a folder collection:

```tsx
import { contents, Schema } from "./src/contents/out/assets";

type BlogPost = Schema["collection"]["blog_post"];

const BlogPost: FunctionComponent<{ slug: string }> = ({ slug }) => {
  const blogPost = contents.blog_post.find(
    (blogPost) => blogPost.slug === slug
  );

  if (!blogPost) {
    return <NotFound />;
  }

  return (
    <div>
      {blogPost.title} {/* <== type safe */}
      <blogPost.body /> {/* <== type safe */}
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

Watch mode tries to be atomic, i.e. to write all contents at once to avoid tripping Webpack or other filesystem watchers.
