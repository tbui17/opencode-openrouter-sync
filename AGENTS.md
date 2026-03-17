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

## Pipeline Overview

```
Push to main
  ├─ CI workflow (ci.yml)
  │    typecheck → build → unit/integration tests → E2E tests
  └─ Release Please workflow (release-please.yml)
       ├─ Creates/updates a release PR (bumps version, updates CHANGELOG)
       └─ On release PR merge → publish job → npm publish via OIDC
```

## CI Workflow Details (`ci.yml`)

- Runs on: push to main + PRs targeting main
- Runtime: Bun (latest via `oven-sh/setup-bun@v2`)
- **opencode CLI is required** for integration tests that run `opencode models`.
  Install via `curl -fsSL https://opencode.ai/install | bash`.
- A seed config must exist at `~/.config/opencode/opencode.json` with `{"provider":{"openrouter":{}}}` or the CLI will fail.
- Tests use `--timeout 60000` because live API + CLI tests need extra time.
- E2E tests run separately via `bun test tests/e2e/`.

## Release Please Workflow (`release-please.yml`)

- Uses `google-github-actions/release-please-action@v4` with `release-type: node`.
- Requires permissions: `contents: write`, `pull-requests: write`, `id-token: write`.
- The `publish` job only runs when `release_created` is true (i.e., a release PR was merged).
- Publish uses Node.js (not Bun) with `npm ci && npm run build && npm publish --access public`.
- npm authentication uses OIDC trusted publishing (no `NODE_AUTH_TOKEN` secret needed) — this must be configured on npmjs.com under the package's publishing settings.

## Known Issues & Gotchas

- **Release Please labeling errors**: GitHub API timing issues can cause Release Please to fail at the labeling step with `"Could not resolve to a node with the global id of ..."`. When this happens, the release tag is not created. The next merge will cause Release Please to skip that version and create a new release PR for the next version instead.
- **Version skips are safe**: If Release Please skips a version (e.g., 1.5.1 → 1.6.0), the pipeline self-corrects — just merge the new release PR.
- **Integration tests restore config**: Tests that write to the real opencode config (`~/.config/opencode/`) must back up and restore the original content in `beforeEach`/`afterEach` to avoid leaking state between tests.

## Release Verification Script

`scripts/verify-release.ts` polls GitHub Actions and npm to verify the full pipeline:

```bash
bun scripts/verify-release.ts                        # defaults: 60 attempts, 15s interval
bun scripts/verify-release.ts --attempts 40 --interval 20
```

Steps: CI passes → Release Please succeeds → GitHub release tag matches npm version.
Uses `Bun.spawnSync(["gh", ...args])` for the `gh` CLI (not template literals, which split args incorrectly).
