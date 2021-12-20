import { resolve, dirname } from "path";

import { FSWatcher } from "chokidar";

import { parseCmsConfig, parseContents } from "./Parser";
import { Content } from "./Content";
import { createAsyncCounter, limited } from "./Time";
import { Config } from "./Config";

const ON_CHANGE_DELAY_MS = 0;
type Watcher = {
  readonly await: () => Promise<void>;
  readonly stop: () => Promise<void>;
};

export const watch = async (
  config: Config,
  onChangeRaw: (event: unknown) => Promise<void>,
): Promise<Watcher> => {
  const counter = createAsyncCounter();
  const onChange = limited(async (event) => {
    counter.incr();
    await onChangeRaw(event);
    counter.decr();
  }, ON_CHANGE_DELAY_MS);
  const configWatcher = new FSWatcher({ awaitWriteFinish: true });
  const contentsWatcher = new FSWatcher({ awaitWriteFinish: true });

  let prevContents: Content[] = [];

  const getAbsoluteLocation = (content: Content): string =>
    resolve(dirname(resolve(config.cwd, config.indexFile)), content.location);

  const updateContents = (nextContents: Content[]): boolean => {
    let isDirty = false;
    for (const prevContent of prevContents) {
      if (
        !nextContents.some(
          (nextContent) => nextContent.location === prevContent.location,
        )
      ) {
        contentsWatcher.unwatch(getAbsoluteLocation(prevContent));
        isDirty = true;
      }
    }

    for (const nextContent of nextContents) {
      if (
        !prevContents.some(
          (prevContent) => prevContent.location === nextContent.location,
        )
      ) {
        contentsWatcher.add(getAbsoluteLocation(nextContent));
        isDirty = true;
      }
    }

    prevContents = nextContents;

    return isDirty;
  };

  let isStopped = false;

  const onConfigChange = async (...event: unknown[]): Promise<void> => {
    if (isStopped) {
      return;
    }
    const cmsConfig = await parseCmsConfig(config);
    if (isStopped) {
      return;
    }

    const nextContents = await parseContents(config, cmsConfig);

    if (isStopped) {
      return;
    }

    updateContents(nextContents);

    onChange(event.slice(0, 2));
  };

  const onContentChange = (...event: unknown[]): void => {
    if (isStopped) {
      return;
    }
    onChange(event.slice(0, 2));
  };

  configWatcher.add(resolve(config.cwd, config.cmsConfigFile));
  configWatcher.on(`all`, onConfigChange);

  contentsWatcher.on(`all`, onContentChange);

  return {
    await: () => counter.await(),
    stop: async () => {
      isStopped = true;
      await counter.await();
      await configWatcher.close();
      await contentsWatcher.close();
    },
  };
};
