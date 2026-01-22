# Handling `no-await-in-loop` ESLint Rule

## The Problem

ESLint's `no-await-in-loop` rule warns when `await` is used inside loops. While often valid (parallel execution is faster), some cases require sequential execution:

- **Pagination**: Each page depends on the previous response
- **Rate limiting**: Must wait between requests
- **Ordered operations**: Results must be processed in sequence

## Solution: Async Iterators

Instead of disabling the rule with comments, use async iterators that encapsulate the pattern:

### Before (ESLint disable comments everywhere)

```typescript
while (hasMore) {
  // eslint-disable-next-line no-await-in-loop
  const response = await queryBullhornEntities<T>({...})
  results.push(...response.data)
  if (response.data.length < pageSize) break
  start += pageSize
}
```

### After (Clean, no disable needed)

```typescript
// for await...of doesn't trigger the rule
for await (const batch of paginateQuery<T>({...})) {
  results.push(...batch)
}

// Or use the helper
const all = await queryAll<T>({...})
```

### Generic Pagination with `paginateWith`

For wrapping higher-level APIs:

```typescript
import { paginateWith } from "../../sdk/bullhorn/pagination.js";

for await (const batch of paginateWith(
  (start, count) => getConsultantCandidates(0, { start, count }),
  { pageSize: 500 }
)) {
  results.push(...batch);
}
```

### Chunk Processing with `processChunks`

For processing arrays in concurrent batches:

```typescript
import { processChunks } from "../../sdk/bullhorn/pagination.js";

for await (const results of processChunks(entries, 10, async (chunk) =>
  Promise.all(chunk.map(([id]) => validateCandidate(id)))
)) {
  allResults.push(...results);
}
```

## When ESLint Disable Is Acceptable

Only use `// eslint-disable-next-line no-await-in-loop` in:

1. **Core utility implementations** (like `paginateQuery` itself)
2. **PDF/file processing** where operations must be sequential
3. **One-off scripts** that won't be reused
4. **Cases where creating an abstraction adds no value**

Always include a reason: `-- Pagination requires sequential requests`

## Available Abstractions

See [Bullhorn Pagination](../bullhorn/implementation-in-the-monorepo/bullhorn-pagination.md) for full documentation.

| Function                           | Use Case                             |
| ---------------------------------- | ------------------------------------ |
| `paginateQuery` / `paginateSearch` | Bullhorn API pagination              |
| `paginateWith`                     | Wrap any paginated function          |
| `processChunks`                    | Process arrays in concurrent batches |
| `queryAll` / `searchAll`           | Fetch all records at once            |
