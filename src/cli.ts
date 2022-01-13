#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { compile } from "./lib/Compiler";
import { CompilerOptions } from "./lib/CompilerOptions";
import { createSilentLogger } from "./lib/Logger";

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
            .option(`dryRun`, {
              describe: `Dry run (don't write output files)`,
              type: `boolean`,
              default: false,
            })
            .option(`eslintConfig`, {
              describe: `Custom eslint config fig (e.g. .eslintrc.js)`,
              type: `string`,
            })
            .option(`exitOnError`, {
              describe: `Exit on error in watch mode`,
              type: `boolean`,
              default: true,
            })
            .option(`markdownLoaderIdentifier`, {
              describe: `Markdown loader identifier within markdown loader module (e.g. 'default' or 'load')`,
              type: `string`,
              demandOption: true,
            })
            .option(`markdownLoaderModule`, {
              describe: `Markdown loader module (e.g. 'next/dynamic' or '../markdown-loader')`,
              type: `string`,
              demandOption: true,
            })
            .option(`markdownTypeIdentifier`, {
              describe: `Markdown type identifier within markdown type module (e.g. 'default' or 'MDXContent')`,
              type: `string`,
              demandOption: true,
            })
            .option(`markdownTypeModule`, {
              describe: `Markdown type module (e.g. '*.mdx' or '../markdown-content')`,
              type: `string`,
              demandOption: true,
            })
            .option(`outFolder`, {
              alias: `o`,
              describe: `Output folder`,
              type: `string`,
              demandOption: true,
            })
            .option(`raw`, {
              alias: `r`,
              describe: `Include raw contents `,
              type: `boolean`,
              default: false,
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
            .option(`schema`, {
              alias: `i`,
              describe: `Netlify config file (config.yml)`,
              type: `string`,
              demandOption: true,
            })
            .option(`silent`, {
              alias: `s`,
              describe: `Suppress console output`,
              type: `boolean`,
              default: false,
            })
            .option(`sourceLocation`, {
              describe: `Include source location in output`,
              type: `boolean`,
              default: false,
            })
            .option(`useLockfile`, {
              describe: `Use lock file to avoid write conflicts`,
              type: `boolean`,
              default: true,
            })
            .option(`watch`, {
              alias: `w`,
              describe: `Recompile on changes`,
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
