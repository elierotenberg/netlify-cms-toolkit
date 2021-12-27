import { z } from "zod";

import { Json } from "./Json";

const StackFrame = z.object({
  fn: z.string(),
  params: Json,
});

type StackFrame = z.infer<typeof StackFrame>;

export const Stack = z.array(StackFrame);

export type Stack = z.infer<typeof Stack>;

export const Warning = z.object({
  stack: Stack,
  message: z.string(),
  details: Json,
});

export type Warning = z.infer<typeof Warning>;

type Context = {
  readonly warnings: Warning[];
};

export const pushWarning = (ctx: Context, warning: Warning): null => {
  ctx.warnings.push(warning);
  return null;
};

export const pushStackFrame = (stack: Stack, stackFrame: StackFrame): Stack => [
  stackFrame,
  ...stack,
];
