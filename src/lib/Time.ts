import prettyMs from "pretty-ms";

import { Logger } from "./Logger";

export const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(() => resolve(), delayMs));

export const forever = (): Promise<never> => new Promise(() => null);

type Deferred<T> = {
  readonly resolve: (t: T) => void;
  readonly reject: (error: unknown) => void;
  readonly await: () => Promise<T>;
};

const defer = <T>(): Deferred<T> => {
  let resolve: null | Deferred<T>[`resolve`] = null;
  let reject: null | Deferred<T>[`reject`] = null;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    resolve: (t) => {
      if (!resolve) {
        throw new Error(`resolve not initialized`);
      }
      resolve(t);
    },
    reject: (error) => {
      if (!reject) {
        throw new Error(`reject not initialized`);
      }
      reject(error);
    },
    await: () => promise,
  };
};

export type AsyncCounterSnapshot = {
  readonly total: number;
  readonly current: number;
  readonly max: number;
};

export type AsyncCounter = {
  readonly incr: () => void;
  readonly decr: () => void;
  readonly clear: () => void;
  readonly await: () => Promise<void>;
  readonly snapshot: () => AsyncCounterSnapshot;
};

export const createAsyncCounter = (
  onChange: (snapshot: AsyncCounterSnapshot) => void = () => null,
): AsyncCounter => {
  let deferred = defer<void>();
  let current = 0;
  let max = 0;
  let total = 0;

  const incr = (): void => {
    total = total + 1;
    current = current + 1;
    if (current > max) {
      max = current;
    }
    onChange(snapshot());
  };

  const decr = (): void => {
    if (current === 0) {
      throw new Error(`AsyncCounter is already 0.`);
    }
    current = current - 1;
    if (current === 0) {
      deferred.resolve();
      deferred = defer();
    }
    onChange(snapshot());
  };

  const clear = (): void => {
    while (current > 0) {
      decr();
    }
  };

  const snapshot = (): AsyncCounterSnapshot => ({
    current,
    max,
    total,
  });

  const await = (): Promise<void> => deferred.await();

  onChange(snapshot());

  return {
    incr,
    decr,
    clear,
    await,
    snapshot,
  };
};

export const throttled = <Params extends unknown[] = []>(
  fn: (...params: Params) => Promise<void>,
): ((...params: Params) => void) => {
  let nextParams: null | Params = null;
  let current: null | Promise<void> = null;

  const drainPending = (): void => {
    if (nextParams) {
      const prevParams = nextParams;
      nextParams = null;
      current = tick(...prevParams);
    } else {
      current = null;
    }
  };

  const tick = (...params: Params): Promise<void> =>
    fn(...params).then(drainPending);

  return (...params: Params) => {
    if (current === null) {
      current = tick(...params);
    } else {
      nextParams = params;
    }
  };
};

export const debounced = <Params extends unknown[] = []>(
  fn: (...params: Params) => unknown,
  delayMs: number,
): ((...params: Params) => void) => {
  let tick: null | NodeJS.Timeout = null;

  return (...params: Params) => {
    if (tick) {
      clearTimeout(tick);
    }
    tick = setTimeout(() => fn(...params), delayMs);
  };
};

export const limited = <Params extends unknown[] = []>(
  fn: (...params: Params) => Promise<void>,
  delayMs: number,
): ((...params: Params) => void) => debounced(throttled(fn), delayMs);

export class Chrono {
  private readonly start: Date;
  private events: {
    readonly label: string;
    readonly date: Date;
  }[];

  public constructor() {
    this.start = new Date();
    this.events = [];
  }

  public readonly mark = (label: string): void => {
    this.events.push({ label, date: new Date() });
  };

  public readonly report = (logger: Logger): void => {
    for (let k = 0; k < this.events.length; k++) {
      const event = this.events[k];
      const prevEventDate = k > 0 ? this.events[k - 1].date : this.start;
      logger.log(
        `${event.label}: ${prettyMs(
          event.date.getTime() - prevEventDate.getTime(),
        )}`,
      );
    }
    if (this.events.length > 0) {
      const lastEvent = this.events[this.events.length - 1];
      logger.log(
        `Total: ${prettyMs(lastEvent.date.getTime() - this.start.getTime())}`,
      );
    }
  };
}
