/**
 * concurrencyLimiter.js
 *
 * Minimal bounded-concurrency task runner — no external dependency (p-limit
 * etc.) needed for what this project uses it for: capping how many Gemini
 * API calls / LibreOffice conversions run at once so a 150-equation document
 * doesn't fire 150 simultaneous outbound requests or child processes.
 */

"use strict";

/**
 * Runs `worker(item, index)` for every item in `items`, at most `limit` at a
 * time. Resolves to an array of results in the SAME ORDER as `items`
 * (regardless of completion order). A single item throwing does NOT abort
 * the others — its slot in the result array holds `{ error }` instead of the
 * worker's return value, so callers can handle per-item failure the same way
 * the rest of the bulk-upload pipeline already does (one bad row never
 * aborts the batch).
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<Array<{ ok: true, value: R } | { ok: false, error: Error }>>}
 */
async function runWithConcurrencyLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      try {
        const value = await worker(items[i], i);
        results[i] = { ok: true, value };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  }

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, runNext));
  return results;
}

module.exports = { runWithConcurrencyLimit };
