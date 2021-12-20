import { readFile } from "fs/promises";
import { resolve } from "path";

import { z } from "zod";

export const Config = z.object({
  cwd: z.string(),
  noEmit: z.boolean().optional(),
  watch: z.boolean().optional(),
  eslintrc: z.string().optional(),
  raw: z.boolean().optional(),
  loader: z.string(),
  cmsConfigFile: z.string(),
  indexFile: z.string(),
  verbose: z.boolean().optional(),
});

export type Config = z.infer<typeof Config>;

export const parseArgv = async (
  argv: Record<string, unknown>,
): Promise<Config> => {
  const cwd = typeof argv.cwd === `string` ? argv.cwd : process.cwd();
  const fromConfigFile =
    typeof argv.configFile === `string`
      ? JSON.parse(
          await readFile(resolve(cwd, argv.configFile), {
            encoding: `utf-8`,
          }),
        )
      : {};
  return Config.parse({
    cwd,
    ...fromConfigFile,
    ...argv,
  });
};

export const log = (config: Config, ...params: unknown[]): void => {
  if (config.verbose) {
    console.log(...params);
  }
};
