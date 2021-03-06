type LogFn = (...args: unknown[]) => void;

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

const silentLogFn: LogFn = () => null;

export const createSilentLogger = (): Logger => ({
  debug: silentLogFn,
  error: silentLogFn,
  info: silentLogFn,
  log: silentLogFn,
  trace: silentLogFn,
  warn: silentLogFn,
});

export const createStringArrayLogger = (): MemoryLogger => {
  const lines: string[] = [];

  const createLogFn =
    (kind: string): LogFn =>
    (...args) => {
      const [head, ...tail] = args
        .map((arg) => `${arg}`)
        .join(``)
        .split(`\n`);
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
