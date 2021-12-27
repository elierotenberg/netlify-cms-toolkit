import { readFile } from "fs/promises";

import { load } from "js-yaml";

import { parse, prettyPrintParseResult } from "../lib/Parser";
import { Schema } from "../lib/Schema";
import { createStringArrayLogger } from "../lib/Logger";
import { withCompilerLock } from "../lib/Lock";

import {
  compilerOptions,
  expectToMatchJsonFile,
  expectToMatchRawFile,
  pkgPath,
} from "./utils";

describe(`Parser`, () => {
  test(`parse`, async () => {
    await withCompilerLock(compilerOptions, async () => {
      const cwd = pkgPath(`.`);
      const schemaRaw = load(
        await readFile(pkgPath(`public/admin/config.yml`), {
          encoding: `utf-8`,
        }),
      );
      const schema = Schema.parse(schemaRaw);

      const result = await parse(cwd, schema);

      await expectToMatchJsonFile(
        result,
        pkgPath(`src/__tests__/fixtures/out/parser.out.json`),
      );

      const logger = createStringArrayLogger();

      prettyPrintParseResult(result, logger);

      await expectToMatchRawFile(
        logger.toString(),
        pkgPath(`src/__tests__/fixtures/out/parser.log`),
      );
    });
  });
});

export {};
