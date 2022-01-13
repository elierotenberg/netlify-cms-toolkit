import { inspect } from "util";

import { z, ZodError } from "zod";

import { Serializable } from "./Serializer";

const StackFrame = z.object({
  fn: z.string(),
  params: Serializable,
});

type StackFrame = z.infer<typeof StackFrame>;

export const Stack = z.array(StackFrame);

export type Stack = z.infer<typeof Stack>;

export const Warning = z.object({
  stack: Stack,
  message: z.string(),
  details: Serializable,
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

export const captureWarning = <T>(
  ctx: Context,
  stack: Stack,
  fn: () => T,
): T | null => {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ZodError) {
      return pushWarning(ctx, {
        message: inspect(error.flatten()),
        details: error.message,
        stack,
      });
    }
    return pushWarning(ctx, {
      message: error.message,
      details: {},
      stack,
    });
  }
};
