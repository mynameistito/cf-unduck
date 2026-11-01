/** Order asynchronous cache operations, including after an earlier failure. */
export const createSerialQueue = (): ((
  operation: () => Promise<void>
) => Promise<void>) => {
  let tail = Promise.resolve();
  return async (operation) => {
    const previous = tail;
    let release: (() => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- The queue owns the completion signal released in finally.
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await operation();
    } finally {
      release?.();
    }
  };
};
