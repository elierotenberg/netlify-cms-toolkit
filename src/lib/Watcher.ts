import { resolve, dirname } from "path";

import { FSWatcher } from "chokidar";

import { parseCmsConfig, parseContents, parseFolders } from "./Parser";
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
  onChangeRaw: (...event: unknown[]) => Promise<void>,
): Promise<Watcher> => {
  let isStopped = false;
  const counter = createAsyncCounter();
  const onChange = limited(async (...event: unknown[]) => {
    if (isStopped) {
      return;
    }
    counter.incr();
    await onChangeRaw(...event);
    counter.decr();
  }, ON_CHANGE_DELAY_MS);
  const configWatcher = new FSWatcher({ awaitWriteFinish: true });
  const foldersWatcher = new FSWatcher({ awaitWriteFinish: true });
  const contentsWatcher = new FSWatcher({ awaitWriteFinish: true });

  let prevContents: Content[] = [];
  let prevFolders: string[] = [];

  const getFolderAbsoluteLocation = (path: string): string =>
    resolve(config.cwd, path);

  const getContentAbsoluteLocation = (content: Content): string =>
    resolve(dirname(resolve(config.cwd, config.indexFile)), content.location);

  const updateFolders = (nextFolders: string[]): boolean => {
    let isDirty = false;
    for (const prevFolder of prevFolders) {
      if (!nextFolders.includes(prevFolder)) {
        foldersWatcher.unwatch(getFolderAbsoluteLocation(prevFolder));
        isDirty = true;
      }
    }

    for (const nextFolder of nextFolders) {
      if (!prevFolders.includes(nextFolder)) {
        foldersWatcher.add(getFolderAbsoluteLocation(nextFolder));
        isDirty = true;
      }
    }

    prevFolders = nextFolders;

    return isDirty;
  };

  const updateContents = (nextContents: Content[]): boolean => {
    let isDirty = false;
    for (const prevContent of prevContents) {
      if (
        !nextContents.some(
          (nextContent) => nextContent.location === prevContent.location,
        )
      ) {
        contentsWatcher.unwatch(getContentAbsoluteLocation(prevContent));
        isDirty = true;
      }
    }

    for (const nextContent of nextContents) {
      if (
        !prevContents.some(
          (prevContent) => prevContent.location === nextContent.location,
        )
      ) {
        contentsWatcher.add(getContentAbsoluteLocation(nextContent));
        isDirty = true;
      }
    }

    prevContents = nextContents;

    return isDirty;
  };

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

    const nextFolders = parseFolders(cmsConfig);

    updateContents(nextContents);
    updateFolders(nextFolders);

    onChange(...event);
  };

  configWatcher.add(resolve(config.cwd, config.cmsConfigFile));
  configWatcher.on(`all`, onConfigChange);
  foldersWatcher.on(`all`, onChange);
  contentsWatcher.on(`all`, onChange);

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
