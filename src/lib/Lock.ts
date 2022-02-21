import { mkdir } from "fs/promises";
import { resolve } from "path";
import { performance } from "perf_hooks";

import { lock, unlock } from "proper-lockfile";

import { CompilerOptions } from "./CompilerOptions";

const noop = (): void => void 0;

type WarningTimer = {
  readonly startMs: number;
  readonly end: () => void;
};

const createWarningTimer = (opts: CompilerOptions): WarningTimer => {
  const startMs = performance.now();
  if (opts.silent) {
    return {
      startMs,
      end: noop,
    };
  }
  const warningThresholdMs = opts.lockFile?.warningThresholdMs;
  if (typeof warningThresholdMs !== `number`) {
    return {
      startMs,
      end: noop,
    };
  }
  const timeout = setTimeout(() => {
    console.warn(`Lockfile threshold exceeded`);
  }, warningThresholdMs);

  return {
    startMs,
    end: () => {
      clearTimeout(timeout);
      const endMs = performance.now();
      const durationMs = endMs - startMs;
      if (endMs > warningThresholdMs) {
        console.warn(`Lockfile took ${durationMs}ms.`);
      }
    },
  };
};

export const withCompilerLock = async <T>(
  opts: CompilerOptions,
  fn: () => Promise<T>,
): Promise<T> => {
  if (!opts.lockFile) {
    return await fn();
  }
  const outFolder = resolve(opts.cwd, opts.outFolder);
  const lockArgs: Parameters<typeof lock> = [
    outFolder,
    {
      lockfilePath: resolve(outFolder, `.lock`),
      stale: opts.lockFile.staleMs,
      update: opts.lockFile.updateMs,
      retries: opts.lockFile.retries ?? 10,
    },
  ];
  await mkdir(outFolder, { recursive: true });
  const warningTimer = createWarningTimer(opts);
  try {
    const release = await lock(...lockArgs);
    const value = await fn();
    await release();
    return value;
  } catch (error) {
    await unlock(...lockArgs);
    throw error;
  } finally {
    warningTimer.end();
  }
};
