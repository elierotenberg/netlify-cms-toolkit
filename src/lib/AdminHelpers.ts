import { readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { createHash } from "crypto";

import { format } from "prettier";
import * as cheerio from "cheerio";
import { z } from "zod";

export const InjectHelpersOptions = z.object({
  cwd: z.string(),
  file: z.string(),
  prettier: z
    .union([
      z.boolean(),
      z.object({
        parser: z.string().optional(),
      }),
    ])
    .optional(),
});

type InjectHelpersOptions = z.infer<typeof InjectHelpersOptions>;

const SCRIPT_PREFIX = `((exports) => {`;
const SCRIPT_SUFFIX = `})({});`;

export const injectHelpers = async ({
  cwd,
  file,
  prettier,
}: InjectHelpersOptions): Promise<void> => {
  const path = resolve(cwd, file);

  const inputHtml = await readFile(path, { encoding: `utf-8` });

  const rawScriptContents = await readFile(
    join(__dirname, `..`, `..`, `build`, `admin-helpers.js`),
    { encoding: `utf-8` },
  );

  const hash = `sha512:${createHash(`sha512`)
    .update(rawScriptContents)
    .digest(`hex`)}`;

  const $ = cheerio.load(inputHtml);

  $(`script[data-netlify-cms-helpers]`).remove();

  const script = `<script data-netlify-cms-helpers="${hash}" type="text/javascript"></script>`;

  const scriptContents = [SCRIPT_PREFIX, rawScriptContents, SCRIPT_SUFFIX].join(
    `\n`,
  );

  $(`body`).prepend(script);
  $(`script[data-netlify-cms-helpers]`).text(scriptContents);

  const outputHtml = (() => {
    if (!prettier) {
      return scriptContents;
    }
    const opts = typeof prettier === `boolean` ? {} : prettier;
    if (!opts.parser) {
      opts.parser = `html`;
    }
    return format($.html(), opts);
  })();

  await writeFile(path, outputHtml, { encoding: `utf-8` });
};
