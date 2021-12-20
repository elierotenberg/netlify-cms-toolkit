import { writeFile } from "fs/promises";
import { resolve } from "path";

import { createContentIndexFileSource } from "./Emitter";
import { parseCmsConfig, parseContents } from "./Parser";
import { Config, log } from "./Config";
import { watch } from "./Watcher";

const compile = async (config: Config): Promise<void> => {
  log(config, `Parsing CMS config...`);
  const cmsConfig = await parseCmsConfig(config);
  log(config, `Parsing contents...`);
  const contents = await parseContents(config, cmsConfig);
  log(config, `Creating content index file source...`);
  const contentIndexFileSource = await createContentIndexFileSource(
    config,
    contents,
  );
  if (config.noEmit) {
    log(config, `Skipping emitting.`);
  } else {
    log(config, `Writing content index file...`);
    await writeFile(
      resolve(config.cwd, config.indexFile),
      contentIndexFileSource,
      {
        encoding: `utf-8`,
      },
    );
  }

  log(config, `All done!`);
};

export const run = async (config: Config): Promise<void> => {
  if (!config.watch) {
    await compile(config);
  } else {
    const onChange = async (event: unknown): Promise<void> => {
      log(config, event);
      await compile(config);
    };
    log(config, `Watching...`);
    await watch(config, onChange);
  }
};
