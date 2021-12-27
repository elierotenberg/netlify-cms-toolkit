type LogFn = (line: string) => void;

export type Logger = {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  log: LogFn;
  warn: LogFn;
  error: LogFn;
};

export const indent = (level: number, text: string): string =>
  text
    .split(`\n`)
    .map((line) => `${` `.repeat(level)}${line}`)
    .join(`\n`);

type MemoryLogger = Logger & {
  readonly toString: () => string;
};

export const createStringArrayLogger = (): MemoryLogger => {
  const lines: string[] = [];

  const createLogFn =
    (kind: string): LogFn =>
    (line) => {
      const [head, ...tail] = line.split(`\n`);
      lines.push(`${`[${kind}]`.padEnd(8)}${head}`);
      for (const line of tail) {
        lines.push(indent(8, line));
      }
    };

  return {
    trace: createLogFn(`trace`),
    debug: createLogFn(`debug`),
    info: createLogFn(`info`),
    log: createLogFn(`log`),
    warn: createLogFn(`warn`),
    error: createLogFn(`error`),
    toString: () => lines.join(`\n`),
  };
};
