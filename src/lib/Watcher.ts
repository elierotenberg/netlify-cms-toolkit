import { join, resolve } from "path";
import { readFile } from "fs/promises";

import { FSWatcher } from "chokidar";
import { load } from "js-yaml";

import { createAsyncCounter, limited } from "./Time";
import { Schema, TaggedCollection, tagCollection } from "./Schema";
import { CompilerOptions } from "./CompilerOptions";
import { withCompilerLock } from "./Lock";

const ON_CHANGE_DELAY_MS = 0;

const getCollectionWatchedPaths = (collection: TaggedCollection): string[] => {
  if (collection.kind === `folder`) {
    return [join(collection.folder, `**/*.{md,yml,yaml}`)];
  }
  if (collection.kind === `files`) {
    return collection.files.map((file) => file.file);
  }
  return [];
};

const getCollectionsWatchedPaths = (schema: Schema): string[] =>
  schema.collections.flatMap((collection) =>
    getCollectionWatchedPaths(tagCollection(collection)),
  );

const diffPaths = (
  prevPaths: string[],
  nextPaths: string[],
): {
  readonly add: string[];
  readonly remove: string[];
} => ({
  add: nextPaths.filter((nextPath) => !prevPaths.includes(nextPath)),
  remove: prevPaths.filter((prevPath) => !nextPaths.includes(prevPath)),
});

type Watcher = {
  readonly await: () => Promise<void>;
  readonly stop: () => Promise<void>;
};

export const watch = (
  opts: CompilerOptions,
  onChangeRaw: (event: unknown, path: string) => Promise<void>,
  onError: (error: unknown) => void,
): Watcher => {
  let isStopped = false;
  const counter = createAsyncCounter();
  const onCollectionsChange = limited(async (event: unknown, path: string) => {
    try {
      if (isStopped) {
        return;
      }
      counter.incr();
      await onChangeRaw(event, path);
      counter.decr();
    } catch (error) {
      onError(error);
    }
  }, ON_CHANGE_DELAY_MS);

  const schemaWatcher = new FSWatcher({
    awaitWriteFinish: { pollInterval: 100, stabilityThreshold: 500 },
    cwd: opts.cwd,
  });

  const collectionsWatcher = new FSWatcher({
    awaitWriteFinish: { pollInterval: 100, stabilityThreshold: 500 },
    cwd: opts.cwd,
  });

  const prevCollectionsWatchedPaths: string[] = [];

  const onSchemaChange = async (
    event: unknown,
    path: string,
  ): Promise<void> => {
    try {
      if (isStopped) {
        return;
      }
      const schema = await withCompilerLock(opts, async () =>
        Schema.parse(
          load(
            await readFile(resolve(opts.cwd, opts.schema), {
              encoding: `utf8`,
            }),
          ),
        ),
      );
      if (isStopped) {
        return;
      }
      const nextCollectionsWatchedPaths = getCollectionsWatchedPaths(schema);
      const diff = diffPaths(
        prevCollectionsWatchedPaths,
        nextCollectionsWatchedPaths,
      );
      for (const path of diff.add) {
        collectionsWatcher.add(path);
      }
      for (const path of diff.remove) {
        collectionsWatcher.unwatch(path);
      }
      if (diff.add.length > 0 || diff.remove.length > 0) {
        onCollectionsChange(event, path);
      }
    } catch (error) {
      onError(error);
    }
  };

  schemaWatcher.on(`all`, onSchemaChange);
  schemaWatcher.add(opts.schema);

  collectionsWatcher.on(`all`, onCollectionsChange);

  return {
    await: () => counter.await(),
    stop: () => {
      isStopped = true;
      return counter.await();
    },
  };
};
