const UINT32_RANGE = 2 ** 32;

export const randomIndex = (length: number): number => {
  if (!Number.isSafeInteger(length) || length < 1 || length > UINT32_RANGE) {
    throw new RangeError("random index length must be between 1 and 2^32");
  }

  const limit = UINT32_RANGE - (UINT32_RANGE % length);

  while (true) {
    const [randomValue = 0] = crypto.getRandomValues(new Uint32Array(1));
    if (randomValue < limit) {
      return randomValue % length;
    }
  }
};
