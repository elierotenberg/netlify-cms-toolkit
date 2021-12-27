import { readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";

import globby from "globby";

import { CompilerOptions } from "../lib/CompilerOptions";
import { mapAsync } from "../lib/util";

const pkgCwd = join(__dirname, `..`, `..`);
export const pkgPath = (...segments: string[]): string =>
  resolve(pkgCwd, ...segments);

export const compilerOptions: CompilerOptions = {
  cwd: pkgPath(`.`),
  markdownLoader: `../dummy-loader`,
  outFolder: `src/__tests__/fixtures/out`,
  schema: `public/admin/config.yml`,
  silent: false,
  saveEmitResult: true,
  saveParseResult: true,
  dryRun: false,
  raw: false,
  watch: false,
  eslintConfig: `.eslintrc.js`,
  markdownPropertyCasing: `pascalCase`,
  propertyCasing: `camelCase`,
  useLockfile: true,
};

export const expectToMatchJsonFile = async (
  value: unknown,
  file: string,
  opts?: {
    readonly create: boolean;
  },
): Promise<void> => {
  if (opts?.create) {
    await writeFile(file, JSON.stringify(value, null, 2), {
      encoding: `utf-8`,
    });
  }
  const fileContents = await readFile(file, { encoding: `utf-8` });
  expect(value).toEqual(JSON.parse(fileContents));
};

export const expectToMatchRawFile = async (
  raw: string,
  file: string,
  opts?: {
    readonly create: boolean;
  },
): Promise<void> => {
  if (opts?.create) {
    await writeFile(file, raw, { encoding: `utf-8` });
  }
  const fileContents = await readFile(file, { encoding: `utf-8` });
  expect(raw).toEqual(fileContents);
};

const readFiles = async (
  cwd: string,
  patterns: string[],
): Promise<{ readonly path: string; readonly contents: string }[]> => {
  const paths = await globby(patterns, { cwd });
  const contents = await mapAsync(paths, async (path) => ({
    path,
    contents: await readFile(resolve(cwd, path), { encoding: `utf-8` }),
  }));

  return contents.sort((a, b) => a.path.localeCompare(b.path));
};

export const expectToMatchRawFiles = async (
  cwdA: string,
  cwdB: string,
  patterns: string[],
): Promise<void> => {
  const [filesA, filesB] = await Promise.all([
    readFiles(cwdA, patterns),
    readFiles(cwdB, patterns),
  ]);

  expect(filesA).toEqual(filesB);
};

export const root = resolve(__dirname, `..`, `..`);
