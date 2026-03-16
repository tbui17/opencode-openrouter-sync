# Rules
- Always use context7 / webfetch to research opencode docs at https://opencode.ai/docs before planning or implementating changes.
- Research other people's implementation of plugins on https://github.com/awesome-opencode/awesome-opencode for best practices, but prefer the ones with more stars. Find problems they might have run into so you don't run into them yourself.
- Create unit / integration tests for your changes.
- Ensure code is SOLID, DRY, modular, and maintainable.
- Keep I/O, infrastructure, and heavy external dependencies at the edge, heavy logic should be easily unit testable. Adhere to hexagonal design principles. Adhere to hexagonal design principles.
- Prefer refactoring code to improve testability over using mocks. Mocks should be minimal.
- Research libraries that have already solved your particular problem before attempting to write your own implementation.
- Always prefer asking questions for clarity over attempting to solve a problem you have low confidence in. Before doing so, ensure your question is well-formed by researching beforehand. If research sufficiently addresses the inquiry, you can proceed with implementation.

# OpenCode Plugin Development Learnings

## Plugin Loading Behavior

**CRITICAL**: OpenCode treats ALL exports from the main entry file as plugin instances and attempts to call them.

```typescript
// WRONG - will cause "syncModels is not a function" error
export default MyPlugin;
export const syncModels = async () => { ... };  // OpenCode tries to call this!

// CORRECT - only default and type exports
export default MyPlugin;
export type { SomeType } from './types.js';
```

Reference: oh-my-openagent source comment:
> `// NOTE: Do NOT export functions from main index.ts! OpenCode treats ALL exports as plugin instances and calls them.`

## Plugin Distribution via npm

OpenCode supports npm packages in the `plugin` array:
- Add `"plugin": ["package-name"]` to `opencode.json`
- OpenCode auto-installs packages at startup using Bun
- Packages are cached in `~/.cache/opencode/node_modules/`

## Subpath Exports Pattern

Utility functions that shouldn't be called as plugins must use subpath exports:

```json
// package.json
{
  "exports": {
    ".": "./dist/index.js",
    "./sync": "./dist/sync.js"
  }
}
```

```typescript
// Users import utilities via subpath
import { syncModels } from 'opencode-openrouter-sync/sync';
```

## Main Entry Export Structure

The main entry file (`src/index.ts`) MUST follow this pattern:

```typescript
// 1. Import plugin implementation
import { OpenRouterModelSyncPlugin } from './plugin.js';

// 2. Export ONLY default (plugin function) and types
export default OpenRouterModelSyncPlugin;
export type { OpenRouterModel, SyncResult, CacheData } from './types.js';

// NEVER export named functions, constants, or classes
// They will be invoked as plugins and fail
```

## Testing Isolation

Tests that modify config files MUST use isolated temp directories:

```typescript
// Use unique temp paths per test file
const tempDir = await mkdtemp(join(tmpdir(), 'openrouter-sync-test-'));
const tempConfigPath = join(tempDir, 'opencode.json');
const tempCachePath = join(tempDir, 'cache.json');

// Mock environment paths
mock.method(config, 'getConfigPath', () => tempConfigPath);
mock.method(cache, 'getCachePath', () => tempCachePath);

// Cleanup after tests
await rm(tempDir, { recursive: true, force: true });
```

Never run tests against real user config (`~/.config/opencode/opencode.json`).
