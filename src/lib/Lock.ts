import { mkdir } from "fs/promises";
import { resolve } from "path";

import { lock, unlock } from "proper-lockfile";

import { CompilerOptions } from "./CompilerOptions";

export const withCompilerLock = async <T>(
  opts: CompilerOptions,
  fn: () => Promise<T>,
): Promise<T> => {
  if (!opts.useLockfile) {
    return await fn();
  }
  const outFolder = resolve(opts.cwd, opts.outFolder);
  const lockArgs: Parameters<typeof lock> = [
    outFolder,
    {
      lockfilePath: resolve(outFolder, `.lock`),
      retries: 10,
    },
  ];
  await mkdir(outFolder, { recursive: true });
  try {
    const release = await lock(...lockArgs);
    const value = await fn();
    await release();
    return value;
  } catch (error) {
    await unlock(...lockArgs);
    throw error;
  }
};
