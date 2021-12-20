import { join } from "path";

import { createContentIndexFileSource } from "../lib/Emitter";
import { parseCmsConfig, parseContents } from "../lib/Parser";

import { ctx } from "./fixtures/static/config";
import { expectToMatchRawFile, root } from "./utils";

describe(`Emitter`, () => {
  test(`createContentIndexFileSource`, async () => {
    const cmsConfig = await parseCmsConfig(ctx);
    const contents = await parseContents(ctx, cmsConfig);

    const source = await createContentIndexFileSource(ctx, contents);

    await expectToMatchRawFile(
      source,
      join(root, `src`, `__tests__`, `fixtures`, `static`, `index.ts`),
    );
  });
});

export {};
