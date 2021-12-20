import { readFile } from "fs/promises";
import { dirname, parse, relative, resolve } from "path";

import { load } from "js-yaml";
import globby from "globby";
import matter from "gray-matter";

import {
  CmsConfig,
  CollectionFile,
  FilesCollection,
  FolderCollection,
  getCollectionI8nStructure,
  I18nStructure,
  tagCollection,
  TaggedCollection,
} from "./CmsConfig";
import { Content } from "./Content";
import { mapAsync } from "./util";
import { Config } from "./Config";

export const parseCmsConfig = async ({
  cwd,
  cmsConfigFile,
}: Config): Promise<CmsConfig> =>
  CmsConfig.parse(
    load(await readFile(resolve(cwd, cmsConfigFile), { encoding: `utf-8` })),
  );

const parseFolderCollectionFileName = (
  file: string,
  i18nStructure?: I18nStructure,
): { readonly slug: string; readonly locale?: string } => {
  const path = parse(file);
  if (!i18nStructure) {
    return {
      slug: path.name,
    };
  }

  if (i18nStructure === `multiple_files`) {
    const parts = path.name.split(`.`);
    const slug = parts.slice(0, -1).join(`.`);
    const locale = parts[parts.length - 1];
    return { slug, locale };
  }

  if (i18nStructure === `multiple_folders`) {
    return {
      slug: path.name,
      locale: path.dir,
    };
  }

  throw new Error(`Unsupported i18n structure: ${i18nStructure}`);
};

const parseFolderCollectionFile = async (
  config: Config,
  cmsConfig: CmsConfig,
  collection: FolderCollection,
  file: string,
): Promise<Content> => {
  const i18nStructure = getCollectionI8nStructure(cmsConfig, collection);

  const { slug, locale } = parseFolderCollectionFileName(file, i18nStructure);

  const absolutePath = resolve(config.cwd, collection.folder, file);

  const location = relative(
    dirname(resolve(config.cwd, config.indexFile)),
    absolutePath,
  );

  const raw = await readFile(absolutePath, {
    encoding: `utf-8`,
  });

  const data = matter(raw).data;

  return {
    collection: collection.name,
    location,
    slug,
    locale,
    data,
    raw: config.raw ? raw : undefined,
  };
};

const parseFolderCollection = async (
  config: Config,
  cmsConfig: CmsConfig,
  collection: FolderCollection,
): Promise<Content[]> => {
  const files = await globby(`**/*.{md,mdx}`, {
    cwd: resolve(config.cwd, collection.folder),
  });

  return await mapAsync(files, (file) =>
    parseFolderCollectionFile(config, cmsConfig, collection, file),
  ).then((files) => files.sort((a, b) => a.location.localeCompare(b.location)));
};

const parseFilesCollectionFile = async (
  config: Config,
  _cmsConfig: CmsConfig,
  collection: FilesCollection,
  file: CollectionFile,
): Promise<Content> => {
  if (file.i18n) {
    throw new Error(`Unsupported i18n for files collections`);
  }

  const absolutePath = resolve(config.cwd, file.file);

  const location = relative(
    dirname(resolve(config.cwd, config.indexFile)),
    absolutePath,
  );

  const path = parse(file.file);

  const raw = await readFile(absolutePath, {
    encoding: `utf-8`,
  });

  const data = matter(raw).data;

  return {
    collection: collection.name,
    location,
    slug: path.name,
    data,
    raw,
  };
};

const parseFilesCollection = async (
  config: Config,
  cmsConfig: CmsConfig,
  collection: FilesCollection,
): Promise<Content[]> => {
  return await mapAsync(collection.files, (file) =>
    parseFilesCollectionFile(config, cmsConfig, collection, file),
  );
};

const parseCollection = async (
  config: Config,
  cmsConfig: CmsConfig,
  collection: TaggedCollection,
): Promise<Content[]> => {
  if (collection.kind === `folder`) {
    return parseFolderCollection(config, cmsConfig, collection);
  }

  if (collection.kind === `files`) {
    return parseFilesCollection(config, cmsConfig, collection);
  }

  return [];
};

export const parseContents = async (
  config: Config,
  cmsConfig: CmsConfig,
): Promise<Content[]> => {
  const collectionContents = await mapAsync(
    cmsConfig.collections,
    (collection) =>
      parseCollection(config, cmsConfig, tagCollection(collection)),
  );
  return collectionContents
    .flat()
    .sort((a, b) => a.location.localeCompare(b.location));
};
