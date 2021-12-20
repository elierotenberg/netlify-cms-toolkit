#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { run } from "./lib/Compiler";
import { parseArgv } from "./lib/Config";

const main = async (): Promise<void> => {
  await Promise.resolve(
    yargs(hideBin(process.argv))
      .command(
        `compile`,
        `Compile contents and generate index file`,
        (yargs) =>
          yargs
            .option(`configFile`, {
              alias: `c`,
              describe: `Configuration file`,
              type: `string`,
            })
            .option(`noEmit`, {
              describe: `Don't emit index file (only print to stdout).`,
              type: `boolean`,
            })
            .option(`watch`, {
              alias: `w`,
              describe: `Watch mode`,
              type: `boolean`,
            })
            .option(`eslintrc`, {
              describe: `Location of eslint config file (defaults to automatic resolution)`,
              type: `string`,
            })
            .option(`raw`, {
              describe: `Include raw contents`,
              type: `boolean`,
            })
            .option(`loader`, {
              describe: `Loader module (e.g. 'next/dynamic')`,
              type: `string`,
            })
            .option(`indexFile`, {
              alias: `i`,
              describe: `Index file`,
              type: `string`,
            })
            .option(`verbose`, {
              alias: `v`,
              describe: `Verbose mode`,
              type: `boolean`,
            }),
        async (argv) => {
          console.log({ argv });
          const config = await parseArgv(argv);
          console.log({ config });
          await run(config);
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
