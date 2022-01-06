#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { compile } from "./lib/Compiler";
import { CompilerOptions } from "./lib/CompilerOptions";
import { createSilentLogger } from "./lib/Logger";
import { casings } from "./lib/util";

const main = async (): Promise<void> => {
  await Promise.resolve(
    yargs(hideBin(process.argv))
      .config()
      .command(
        `compile`,
        `Compile contents and generate index file`,
        (yargs) =>
          yargs
            .option(`cwd`, {
              describe: `Working directory (defaults to proces.cwd)`,
              type: `string`,
              default: process.cwd(),
            })
            .option(`schema`, {
              alias: `i`,
              describe: `Netlify config file (config.yml)`,
              type: `string`,
              demandOption: true,
            })
            .option(`outFolder`, {
              alias: `o`,
              describe: `Output folder`,
              type: `string`,
              demandOption: true,
            })
            .option(`saveParseResult`, {
              describe: `Save intermediate parse results`,
              type: `boolean`,
              default: false,
            })
            .option(`saveEmitResult`, {
              describe: `Save intermediate emit results`,
              type: `boolean`,
              default: false,
            })
            .option(`useLockfile`, {
              describe: `Use lock file to avoid write conflicts`,
              type: `boolean`,
              default: true,
            })
            .option(`raw`, {
              alias: `r`,
              describe: `Include raw contents `,
              type: `boolean`,
              default: false,
            })
            .option(`markdownLoader`, {
              describe: `Loader module (e.g. 'next/dynamic')`,
              type: `string`,
              demandOption: true,
            })
            .option(`eslintConfig`, {
              describe: `Custom eslint config fig (e.g. .eslintrc.js)`,
              type: `string`,
            })
            .option(`markdownPropertyCasing`, {
              describe: `Casing convention for markdown property naming`,
              choices: casings,
              default: `preserve`,
            })
            .option(`propertyCasing`, {
              describe: `Casing convention for non-markdown property naming`,
              choices: casings,
            })
            .option(`watch`, {
              alias: `w`,
              describe: `Recompile on changes`,
              type: `boolean`,
              default: false,
            })
            .option(`exitOnError`, {
              describe: `Exit on error in watch mode`,
              type: `boolean`,
              default: true,
            })
            .option(`silent`, {
              alias: `s`,
              describe: `Suppress console output`,
              type: `boolean`,
              default: false,
            })
            .option(`dryRun`, {
              describe: `Dry run (don't write output files)`,
              type: `boolean`,
              default: false,
            }),
        async (argv) => {
          const config = CompilerOptions.parse(argv);
          const logger = config.silent ? createSilentLogger() : console;
          await compile(config, logger);
        },
      )
      .demandCommand()
      .help().argv,
  );
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  throw new Error(`This should be the main module.`);
}

export {};
