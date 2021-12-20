import {
  AsyncCounter,
  AsyncCounterSnapshot,
  createAsyncCounter,
  sleep,
  throttled,
  debounced,
  limited,
} from "../lib/Time";

const expectCounter = (
  counter: AsyncCounter,
  snapshot: AsyncCounterSnapshot,
): void => {
  expect(counter.snapshot()).toEqual(snapshot);
};

const TIME_QUANTUM_MS = 100;

const delay = (factor: number): number => factor * TIME_QUANTUM_MS;

jest.setTimeout(delay(100));

describe(`Watcher`, () => {
  test(`AsyncCounter`, async () => {
    const counter = createAsyncCounter();
    expectCounter(counter, {
      current: 0,
      max: 0,
      total: 0,
    });

    counter.incr();

    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 1,
    });

    counter.incr();

    expectCounter(counter, {
      current: 2,
      max: 2,
      total: 2,
    });

    counter.decr();

    expectCounter(counter, {
      current: 1,
      max: 2,
      total: 2,
    });

    counter.clear();

    expectCounter(counter, {
      current: 0,
      max: 2,
      total: 2,
    });

    counter.incr();
    sleep(delay(1)).then(() => counter.decr());

    counter.incr();
    sleep(delay(2)).then(() => counter.decr());

    counter.incr();

    sleep(delay(3)).then(() => counter.decr());

    expectCounter(counter, {
      current: 3,
      max: 3,
      total: 5,
    });

    await sleep(delay(0));

    expectCounter(counter, {
      current: 3,
      max: 3,
      total: 5,
    });

    await counter.await();

    expectCounter(counter, {
      current: 0,
      max: 3,
      total: 5,
    });
  });
  test(`throttled`, async () => {
    const counter = createAsyncCounter();

    const rawFn = async (): Promise<void> => {
      counter.incr();
      await sleep(delay(2));
      counter.decr();
    };

    const throttledFn = throttled(rawFn);

    throttledFn();
    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 1,
    });

    throttledFn();
    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 1,
    });

    await sleep(delay(1));
    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 1,
    });

    throttledFn();
    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 1,
    });

    await sleep(delay(5));
    expectCounter(counter, {
      current: 0,
      max: 1,
      total: 2,
    });
  });

  test(`debounced`, async () => {
    const counter = createAsyncCounter();

    const rawFn = async (): Promise<void> => {
      counter.incr();
      await sleep(delay(5));
      counter.decr();
    };

    const debouncedFn = debounced(rawFn, delay(1));

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expectCounter(counter, { current: 0, max: 0, total: 0 });

    await sleep(delay(2));

    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 1,
    });

    await sleep(delay(5));

    expectCounter(counter, {
      current: 0,
      max: 1,
      total: 1,
    });

    debouncedFn();
    debouncedFn();
    debouncedFn();

    await sleep(delay(2));

    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 2,
    });

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 2,
    });

    await sleep(delay(1));

    expectCounter(counter, {
      current: 2,
      max: 2,
      total: 3,
    });

    await counter.await();

    expectCounter(counter, {
      current: 0,
      max: 2,
      total: 3,
    });
  });

  test(`limited`, async () => {
    const counter = createAsyncCounter();

    const rawFn = async (): Promise<void> => {
      counter.incr();
      await sleep(delay(5));
      counter.decr();
    };

    const limitedFn = limited(rawFn, delay(1));

    expectCounter(counter, {
      current: 0,
      max: 0,
      total: 0,
    });

    limitedFn();
    limitedFn();
    limitedFn();

    expectCounter(counter, {
      current: 0,
      max: 0,
      total: 0,
    });

    await sleep(delay(1));

    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 1,
    });

    limitedFn();
    limitedFn();
    limitedFn();

    await sleep(delay(1));

    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 1,
    });

    await sleep(delay(5));

    expectCounter(counter, {
      current: 1,
      max: 1,
      total: 2,
    });

    await counter.await();

    expectCounter(counter, {
      current: 0,
      max: 1,
      total: 2,
    });
  });
});

export {};
