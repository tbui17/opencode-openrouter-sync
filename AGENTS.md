# Build & Test Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run typecheck      # Type check without emitting
npm test               # Run all tests
npm test -- tests/tui.test.ts           # Run single test file
npm test -- tests/plugin.test.ts        # Run single test file
npm run test:run       # Run tests once (no watch)
npm run clean          # Remove dist/ directory
```

# Rules
- Always use context7 / webfetch to research opencode docs at https://opencode.ai/docs before planning or implementating changes.
- Research other people's implementation of plugins on https://github.com/awesome-opencode/awesome-opencode for best practices, but prefer the ones with more stars.
- Create unit / integration tests for your changes.
- Ensure code is SOLID, DRY, modular, and maintainable.
- Keep I/O, infrastructure, and heavy external dependencies at the edge. Heavy logic should be easily unit testable.
- Prefer refactoring code to improve testability over using mocks. Mocks should be minimal.
- Research libraries that have already solved your problem before attempting to write your own implementation.
- Always prefer asking questions for clarity over attempting to solve a problem you have low confidence in.

# Code Style Guidelines

## Imports

```typescript
// Use .js extension for local imports (required for ESM)
import { something } from './module.js';
import type { SomeType } from './types.js';

// Node built-ins
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
```

## Formatting

- 2-space indentation
- Single quotes for strings (double quotes in JSON)
- Trailing commas in multiline arrays/objects
- Max line length: ~100 chars

## Types

```typescript
// Prefer interfaces for object shapes
export interface ModelConfig { id: string; name?: string; }

// Use discriminated unions for results
export type FetchResult = { data: Model[] } | { error: ApiError };

// Use const objects for string unions
const ErrorMessages = { NETWORK_ERROR: 'Network error' } as const;

// Type guards for runtime validation
function isValidModel(data: unknown): data is Model {
  return typeof data === 'object' && data !== null && 'id' in data;
}
```

## Functions

```typescript
// Pure functions at module level, exported for testability
export async function fetchModels(): Promise<FetchResult> { /* ... */ }

// Helper functions are private (not exported)
function processData(data: unknown): Result { /* ... */ }

// Use async/await, not .then() chains
const result = await fetch(url);
```

## Error Handling

```typescript
// Return structured errors, don't throw
return { error: { type: 'network', message: 'Failed to fetch' } };

// Log errors at the edge (in plugin.ts, not utilities)
console.error(`${ErrorMessages.NETWORK_ERROR}: ${error.message}`);

// Always handle both branches of discriminated unions
if ('error' in result) { /* handle error */ } 
else { /* use result.data */ }
```

## Testing (bun:test)

```typescript
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

describe('moduleName', () => {
  test('does something', () => { expect(result).toBe(expected); });
  test('handles errors', async () => { expect('error' in result).toBe(true); });
});

// Helper functions at top of test file
function createMockModel(overrides = {}): Model {
  return { id: 'test', ...overrides };
}
```

## Comments

- Only when code cannot be self-documenting
- JSDoc for exported interfaces and types
- No inline comments for obvious code

# OpenCode Plugin Development

## Plugin Loading (CRITICAL)

OpenCode treats ALL exports from `src/index.ts` as plugin instances and calls them.

```typescript
// WRONG - will cause "syncModels is not a function" error
export default MyPlugin;
export const syncModels = async () => { ... };  // OpenCode tries to call this!

// CORRECT - only default and type exports
export default MyPlugin;
export type { SomeType } from './types.js';
```

## Subpath Exports

Utility functions that shouldn't be called as plugins use subpath exports:

```json
// package.json
{ "exports": { ".": "./dist/index.js", "./sync": "./dist/sync.js" } }
```

```typescript
// Users import utilities via subpath
import { syncModels } from 'opencode-openrouter-sync/sync';
```

## Testing Isolation

Tests that modify config files MUST use isolated temp directories:

```typescript
const tempDir = await mkdtemp(join(tmpdir(), 'openrouter-sync-test-'));
// ... use tempDir for test paths ...
await rm(tempDir, { recursive: true, force: true });  // Cleanup after tests
```

Never run tests against real user config (`~/.config/opencode/opencode.json`).

# CI/CD & Release Process

Uses **Release Please** for automated versioning and **npm OIDC** for secure publishing.

## Conventional Commits

| Type | Effect |
|------|--------|
| `feat:` | Minor version bump |
| `fix:` | Patch version bump |
| `feat!:` or `BREAKING CHANGE:` | Major version bump |

Push to main → Release Please creates PR → Merge → Auto-publishes to npm.
