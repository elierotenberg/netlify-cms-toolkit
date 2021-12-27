import { readFile } from "fs/promises";

import { load } from "js-yaml";

import { Schema } from "../lib/Schema";
import { parse } from "../lib/Parser";
import { emit, prettyPrintEmitResult } from "../lib/Emitter";
import { createStringArrayLogger } from "../lib/Logger";
import { withCompilerLock } from "../lib/Lock";

import {
  compilerOptions,
  expectToMatchJsonFile,
  expectToMatchRawFile,
  pkgPath,
} from "./utils";

describe(`Emitter`, () => {
  test(`emit`, async () => {
    await withCompilerLock(compilerOptions, async () => {
      const schemaRaw = load(
        await readFile(pkgPath(`public/admin/config.yml`), {
          encoding: `utf-8`,
        }),
      );
      const schema = Schema.parse(schemaRaw);

      const parseResult = await parse(pkgPath(`.`), schema);

      const emitResult = await emit(pkgPath(`.`), compilerOptions, parseResult);

      await expectToMatchJsonFile(
        emitResult,
        pkgPath(`src/__tests__/fixtures/out/emitter.out.json`),
      );

      await expectToMatchRawFile(
        emitResult.index.source,
        pkgPath(`src/__tests__/fixtures/out/index.ts`),
      );

      const logger = createStringArrayLogger();

      prettyPrintEmitResult(emitResult, logger);

      await expectToMatchRawFile(
        logger.toString(),
        pkgPath(`src/__tests__/fixtures/out/emitter.log`),
      );
    });
  });
});
