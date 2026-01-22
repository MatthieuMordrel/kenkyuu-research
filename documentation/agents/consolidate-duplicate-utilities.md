# Consolidate Duplicate Utility Functions

## Goal

Find utility functions that are duplicated across multiple files and consolidate them into a shared utilities package or module. This reduces code duplication, improves maintainability, and ensures consistent behavior across the codebase.

## When to Consolidate

A function should be consolidated if it:

- Appears in **2+ files** with identical or very similar implementations
- Is a **pure utility function** (no side effects, no domain-specific logic)
- Has a **stable API** (unlikely to change frequently)
- Is **general-purpose** (not tied to a specific feature or domain)

## Process

### 1. Find Duplicates

Search for common utility patterns:

- `sleep`, `delay`, `wait` functions
- `chunk`, `chunkArray`, `splitArray` functions
- `formatDate`, `formatTime`, `formatTimestamp` functions
- `normalize`, `normalise`, `sanitize` string functions
- `deduplicate`, `unique`, `removeDuplicates` functions
- `debounce`, `throttle` functions
- Array/object manipulation utilities
- Validation and transformation helpers
- Type conversion utilities

**Tools to use:**

- `grep` for exact function name matches
- `codebase_search` for semantic searches of similar patterns
- Check function signatures and implementations for similarity
- Review import statements to identify potential duplicates

### 2. Verify Similarity

Read the implementations to confirm they're functionally equivalent:

- Same logic/algorithm
- Same parameter types
- Same return types
- Minor differences (variable names, formatting, comments) are acceptable
- Consider edge cases and error handling consistency

### 3. Identify Consolidation Target

Determine where to place the shared function:

- **Existing utilities package/module**: If the project already has a shared utilities location
- **New utilities module**: Create a new `utils/` or `shared/` directory if none exists
- **Language-specific conventions**: Follow project structure patterns (e.g., `lib/utils`, `src/utils`, `shared/utils`)

### 4. Create Shared Function

Add the function to the target location:

- Create a new file or add to an existing utilities file
- Include comprehensive JSDoc comments and documentation
- Export the function appropriately (named export, default export, or via index file)
- Follow existing code style and patterns in the project
- Ensure proper type definitions (TypeScript) or type hints (Python, etc.)

### 5. Update All Usages

For each file using the duplicate:

- Add the utilities package/module to dependencies if needed (for package-based projects)
- Import the shared function using the appropriate import syntax
- Remove the local function definition
- Update all function calls if the function was renamed
- Update any related type imports if applicable

### 6. Verify

- Install/update dependencies if needed (run package manager install command)
- Run type checking/linting to ensure type safety and code quality
- Run tests to verify functionality is preserved
- Verify no local function definitions remain (use `grep` or search tools)
- Check that all imports resolve correctly

## Project Structure Considerations

The consolidation target location depends on your project structure:

- **Monorepo**: May have a shared package (e.g., `packages/utils/`, `packages/shared/`)
- **Single package**: May have a `utils/` or `lib/utils/` directory
- **Language conventions**:
  - TypeScript/JavaScript: `src/utils/` or `lib/utils/`
  - Python: `utils/` or `src/utils/`
  - Other languages: Follow language-specific conventions

**Best practices:**

- Each utility function should be in its own file or logically grouped
- Export all utilities from a central index file when possible
- Follow language-specific best practices (proper types, documentation, testing)

## Examples

### Before Consolidation

```typescript
// File 1: src/services/cache.ts
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// File 2: src/services/logging.ts
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
```

### After Consolidation

```typescript
// utils/formatBytes.ts (or src/utils/formatBytes.ts)
/**
 * Format a byte count as a human-readable string.
 *
 * @param bytes - The number of bytes
 * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// utils/index.ts (or src/utils/index.ts)
export { formatBytes } from "./formatBytes.js";

// File 1 & 2: Import and use
import { formatBytes } from "@/utils"; // or './utils' or '@project/utils' depending on setup
```

## Common Patterns Found

Common utility functions that are often duplicated include:

- **`sleep`/`delay`/`wait`** - Promise-based delay functions
- **`chunkArray`/`chunk`** - Array chunking utilities
- **`normalizeString`/`normaliseString`** - String normalization
- **`deduplicate`/`unique`/`removeDuplicates`** - Array deduplication
- **`formatBytes`** - Byte size formatting
- **`debounce`/`throttle`** - Function rate limiting
- **`deepClone`/`deepCopy`** - Deep object cloning
- **`isEmpty`/`isNotEmpty`** - Value emptiness checks
- **`pick`/`omit`** - Object property selection
- **`groupBy`/`group`** - Array grouping utilities

## Notes

- **Don't over-abstract**: Only consolidate functions that are actually duplicated (2+ occurrences)
- **Keep it focused**: Utilities should contain general-purpose functions, not domain-specific logic
- **Type safety**: Ensure proper type definitions and run type checking after changes
- **Documentation**: Always include comprehensive documentation (JSDoc, docstrings, etc.) for shared utilities
- **Testing**: Consider adding unit tests for consolidated utilities
- **Versioning**: For package-based projects, follow semantic versioning when making breaking changes
- **Backward compatibility**: When possible, maintain backward compatibility or provide migration paths
