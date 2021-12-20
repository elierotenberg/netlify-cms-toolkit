# `netlify-cms-toolkit`

This toolkit supercharges Netlify CMS with better developer experience.

## Install

`npm i netlify-cms-toolkit`

### Compiling contents

`npx netlify-cms-toolkit compile`

Crawls your contents to generate a very clean, statically typed index file.

You can then import your contents from other files (e.g. from a NextJS app) with very strict static typing.
This works especially well when combining with `netlify-cms-toolkit/runtime`:

```ts
import { contents } from "../contents";

const { findAll, findUnique } = createRuntime(contents);

findAll({
  locale: "en",
}); // find all contents with locale 'en' with a very detailled type.
```
