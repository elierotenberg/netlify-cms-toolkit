import { Config } from "../../../lib/Config";
import { root } from "../../utils";

export const ctx: Config = {
  cwd: root,
  indexFile: `src/__tests__/fixtures/static/index.ts`,
  cmsConfigFile: `src/__tests__/fixtures/static/config.yml`,
  loader: `../../../../src/__tests__/fixtures/dummy-loader`,
  raw: true,
};
