import { resolve } from "path";

import { compile } from "../lib/Compiler";
import { CompilerOptions } from "../lib/CompilerOptions";
import { createStringArrayLogger } from "../lib/Logger";

import { compilerOptions, expectToMatchRawFiles } from "./utils";

describe(`Compiler`, () => {
  test(`compile`, async () => {
    const logger = createStringArrayLogger();

    const tmpCompilerOptions: CompilerOptions = {
      ...compilerOptions,
      outFolder: `${compilerOptions.outFolder}.test`,
    };

    await compile(tmpCompilerOptions, logger);

    await expectToMatchRawFiles(
      resolve(tmpCompilerOptions.cwd, tmpCompilerOptions.outFolder),
      resolve(compilerOptions.cwd, compilerOptions.outFolder),
      [`**/*.{ts,md}`],
    );
  });
});
