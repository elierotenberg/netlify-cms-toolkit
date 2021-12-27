import { z } from "zod";

import { Casing } from "./util";

export const CompilerOptions = z.object({
  cwd: z.string(),
  schema: z.string(),
  outFolder: z.string(),
  saveParseResult: z.boolean().optional(),
  saveEmitResult: z.boolean().optional(),
  raw: z.boolean().optional(),
  markdownLoader: z.string(),
  eslintConfig: z.string().optional(),
  markdownPropertyCasing: Casing.optional(),
  propertyCasing: Casing.optional(),
  watch: z.boolean().optional(),
  silent: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  useLockfile: z.boolean().optional(),
});

export type CompilerOptions = z.infer<typeof CompilerOptions>;
