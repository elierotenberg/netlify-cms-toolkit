import { z } from "zod";

export const CompilerOptions = z.object({
  cwd: z.string(),
  dryRun: z.boolean().optional(),
  eslintConfig: z.string().optional(),
  exitOnError: z.boolean().optional(),
  narrowSlugs: z.boolean().optional(),
  markdownLoaderIdentifier: z.string(),
  markdownLoaderModule: z.string(),
  markdownLoaderParamsModule: z.string(),
  markdownLoaderParamsIdentifier: z.string(),
  markdownTypeIdentifier: z.string(),
  markdownTypeModule: z.string(),
  outFolder: z.string(),
  raw: z.boolean().optional(),
  saveEmitResult: z.boolean().optional(),
  saveParseResult: z.boolean().optional(),
  schema: z.string(),
  silent: z.boolean().optional(),
  sourceLocation: z.boolean().optional(),
  useLockfile: z.boolean().optional(),
  watch: z.boolean().optional(),
});

export type CompilerOptions = z.infer<typeof CompilerOptions>;
