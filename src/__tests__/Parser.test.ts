import { join } from "path";

import { parseCmsConfig, parseContents } from "../lib/Parser";

import { ctx } from "./fixtures/static/config";
import { expectToMatchJsonFile, root } from "./utils";

describe(`Parser`, () => {
  test(`parseCmsConfig`, async () => {
    const config = await parseCmsConfig(ctx);

    await expectToMatchJsonFile(
      config,
      join(root, `src`, `__tests__`, `fixtures`, `static`, `config.json`),
    );
  });
  test(`parseContents`, async () => {
    const cmsConfig = await parseCmsConfig(ctx);

    const contents = await parseContents(ctx, cmsConfig);

    await expectToMatchJsonFile(
      contents,
      join(root, `src`, `__tests__`, `fixtures`, `static`, `contents.json`),
    );
  });
});

export {};
