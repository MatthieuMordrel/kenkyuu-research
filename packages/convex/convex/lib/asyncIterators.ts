/**
 * Async-iteration helpers for loops that must run sequentially
 * (external API rate limits, ordered side effects, readable log ordering).
 *
 * Call sites consume these with `for await...of`, which keeps the awaits
 * inside the generator instead of inside a plain loop body.
 */

/**
 * Runs `fn` over `items` strictly one at a time, yielding each result in
 * order. Use when iterations must NOT overlap — e.g. rate-limited external
 * API calls (Finnhub free tier) or when sequential log output matters.
 *
 * @param items - Items to process in order.
 * @param fn - Async worker invoked with the item and its index.
 */
export async function* mapSequentially<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>
): AsyncGenerator<R, void, undefined> {
  for (let index = 0; index < items.length; index++) {
    // Async generators implicitly await yielded promises, so each item
    // fully completes before the next one starts.
    yield fn(items[index]!, index);
  }
}
