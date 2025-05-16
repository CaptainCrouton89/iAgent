export function createStreamBuffer<T>() {
  const queue: T[] = [];
  const resolvers: ((value: IteratorResult<T>) => void)[] = [];
  let isDone = false;

  return {
    push(item: T) {
      if (resolvers.length) {
        resolvers.shift()!({ value: item, done: false });
      } else {
        queue.push(item);
      }
    },
    end() {
      isDone = true;
      while (resolvers.length) {
        resolvers.shift()!({ value: undefined, done: true });
      }
    },
    [Symbol.asyncIterator]() {
      return {
        next: (): Promise<IteratorResult<T>> => {
          if (queue.length) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (isDone) {
            return Promise.resolve({ value: undefined, done: true });
          }
          return new Promise((resolve) => resolvers.push(resolve));
        },
      };
    },
  };
}
