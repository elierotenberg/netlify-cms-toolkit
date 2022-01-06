import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
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

    const outFolder = resolve(opts.cwd, opts.outFolder);

    logger.log(`Parsing schema...`);
    const schema = Schema.parse(
      load(
        await readFile(resolve(opts.cwd, opts.schema), { encoding: `utf-8` }),
      ),
    );
    chrono.mark(`Parse schema`);

    logger.log(`Parsing collections...`);
    const parserResult = await parse(opts.cwd, schema);

    chrono.mark(`Parse collections`);
    prettyPrintParseResult(parserResult, logger);

    if (!opts.dryRun) {
      await mkdir(outFolder, { recursive: true });
    }

    if (opts.saveParseResult && !opts.dryRun) {
      logger.log(`Saving parse result...`);
      await writeFile(
        resolve(outFolder, `parser.out.json`),
        JSON.stringify(parserResult, null, 2),
        { encoding: `utf-8` },
      );
      chrono.mark(`Save parse result`);
    }

    logger.log(`Emitting assets...`);

    const emitResult = await emit(opts.cwd, opts, parserResult);
    chrono.mark(`Emit assets`);

    prettyPrintEmitResult(emitResult, logger);

    if (opts.saveEmitResult && !opts.dryRun) {
      logger.log(`Saving emit result...`);
      await writeFile(
        resolve(outFolder, `emitter.out.json`),
        JSON.stringify(emitResult, null, 2),
        { encoding: `utf-8` },
      );
      chrono.mark(`Save emitter result`);
    }

    if (!opts.dryRun) {
      const assetsNextFolder = resolve(outFolder, `assets.next`);
      const assetsPrevFolder = resolve(outFolder, `assets.prev`);
      const assetsFolder = resolve(outFolder, `assets`);
      logger.log(`Writing assets to temp folder...`);

      await rm(assetsNextFolder, {
        recursive: true,
      }).catch(() => null);
      await mkdir(assetsNextFolder, {
        recursive: true,
      });
      chrono.mark(`Create temp folder`);
      logger.log(`Writing markdown assets...`);
      await mapAsync(emitResult.markdownAssets, async ({ path, source }) => {
        await mkdir(dirname(resolve(assetsNextFolder, path)), {
          recursive: true,
        });
        await writeFile(resolve(assetsNextFolder, path), source, {
          encoding: `utf-8`,
        });
      });
      chrono.mark(`Save markdown assets`);
      logger.log(`Saving index...`);
      await writeFile(
        resolve(assetsNextFolder, emitResult.index.path),
        emitResult.index.source,
        { encoding: `utf-8` },
      );
      chrono.mark(`Save index`);

      logger.log(`Swapping with previous version...`);
      await rename(assetsFolder, assetsPrevFolder).catch(() => null);
      await rename(assetsNextFolder, assetsFolder).catch(() => null);
      logger.log(`Deleting previous version...`);
      await rm(assetsPrevFolder, { recursive: true }).catch(() => null);
      chrono.mark(`Swap assets`);
    }

    chrono.report(logger);
  });
};

export const compile = async (
  opts: CompilerOptions,
  logger: Logger,
): Promise<void> => {
  if (!opts.watch) {
    return await compileOnce(opts, logger);
  }

  watch(
    opts,
    async (event, file) => {
      logger.log(event, file);
      await compileOnce(opts, logger);
    },
    (error) => {
      logger.error(error);
      if (opts.exitOnError) {
        process.exit(1);
      }
    },
  );

  return await forever();
};
