import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname, resolve } from "path";

import { load } from "js-yaml";

import { mapAsync } from "./util";
import { Chrono, forever } from "./Time";
import { parse, prettyPrintParseResult } from "./Parser";
import { Schema } from "./Schema";
import { emit, prettyPrintEmitResult } from "./Emitter";
import { watch } from "./Watcher";
import { Logger } from "./Logger";
import { CompilerOptions } from "./CompilerOptions";
import { withCompilerLock } from "./Lock";

const compileOnce = async (
  opts: CompilerOptions,
  logger: Logger,
): Promise<void> => {
  await withCompilerLock(opts, async () => {
    const chrono = new Chrono();
    chrono.mark(`Start`);
    if (!opts.silent) {
      logger.log(`Parsing schema...`);
    }
    const schema = Schema.parse(
      load(
        await readFile(resolve(opts.cwd, opts.schema), { encoding: `utf-8` }),
      ),
    );
    chrono.mark(`Parse schema`);

    if (!opts.silent) {
      logger.log(`Parsing collections...`);
    }
    const parserResult = await parse(opts.cwd, schema);
    chrono.mark(`Parse collections`);
    if (!opts.silent) {
      prettyPrintParseResult(parserResult, logger);
    }
    if (opts.saveParseResult && !opts.dryRun) {
      if (!opts.silent) {
        logger.log(`Saving parse result...`);
      }
      await mkdir(resolve(opts.cwd, opts.outFolder), { recursive: true });
      await writeFile(
        resolve(opts.cwd, opts.outFolder, `parser.out.json`),
        JSON.stringify(parserResult, null, 2),
        { encoding: `utf-8` },
      );
      chrono.mark(`Save parse result`);
    }

    if (!opts.silent) {
      logger.log(`Emitting assets...`);
    }
    const emitResult = await emit(opts.cwd, opts, parserResult);
    chrono.mark(`Emit assets`);
    if (!opts.silent) {
      prettyPrintEmitResult(emitResult, logger);
    }

    if (opts.saveEmitResult && !opts.dryRun) {
      if (!opts.silent) {
        logger.log(`Saving emit result...`);
      }
      await mkdir(resolve(opts.cwd, opts.outFolder), { recursive: true });
      await writeFile(
        resolve(opts.cwd, opts.outFolder, `emitter.out.json`),
        JSON.stringify(emitResult, null, 2),
        { encoding: `utf-8` },
      );
      chrono.mark(`Save emitter result`);
    }

    if (!opts.dryRun) {
      if (!opts.silent) {
        logger.log(`Saving markdown assets...`);
        await rm(resolve(opts.cwd, opts.outFolder, `assets`), {
          recursive: true,
        });
        await mkdir(resolve(opts.cwd, opts.outFolder, `assets`), {
          recursive: true,
        });
        await mapAsync(emitResult.markdownAssets, async ({ path, source }) => {
          await mkdir(dirname(resolve(opts.cwd, opts.outFolder, path)), {
            recursive: true,
          });
          await writeFile(resolve(opts.cwd, opts.outFolder, path), source, {
            encoding: `utf-8`,
          });
        });
        chrono.mark(`Save markdown assets`);
        logger.log(`Saving index...`);
        await mkdir(resolve(opts.cwd, opts.outFolder), { recursive: true });
        await writeFile(
          resolve(opts.cwd, opts.outFolder, emitResult.index.path),
          emitResult.index.source,
          { encoding: `utf-8` },
        );
        chrono.mark(`Save index`);
      }
    }

    if (!opts.silent) {
      chrono.report(logger);
    }
  });
};

export const compile = async (
  opts: CompilerOptions,
  logger: Logger,
): Promise<void> => {
  if (!opts.watch) {
    return await compileOnce(opts, logger);
  }

  watch(opts, async (event, file) => {
    if (!opts.silent) {
      console.log(event, file);
      await compileOnce(opts, logger);
    }
  });

  return await forever();
};
