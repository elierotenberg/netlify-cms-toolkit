import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";

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

export const root = resolve(__dirname, `..`, `..`);
