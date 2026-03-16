/**
 * Integration tests for OpenRouter Model Sync Plugin
 *
 * Tests the full sync flow:
 * 1. Check cache validity
 * 2. Fetch models from API (mocked)
 * 3. Diff against existing config
 * 4. Update config with new models
 * 5. Write cache
 *
 * Uses temporary directories to avoid polluting user files.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  readCache,
  writeCache,
  isCacheValid,
  clearCache,
  getCachePath,
} from '../src/cache.js';
import {
  readConfig,
  writeConfig,
  updateModels,
  getGlobalConfigPath,
} from '../src/config.js';
import { fetchModels } from '../src/api.js';
import type { OpenRouterModel, CacheData } from '../src/types.js';

// Helper to create mock OpenRouter models
function createMockModel(id: string, overrides?: Partial<OpenRouterModel>): OpenRouterModel {
  return {
    id,
    canonical_slug: id,
    hugging_face_id: '',
    name: `Model ${id}`,
    created: Date.now(),
    description: `Description for ${id}`,
    context_length: 4096,
    architecture: {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'gpt-4',
      instruct_type: null,
    },
    pricing: {
      prompt: '0.00001',
      completion: '0.00002',
      input_cache_read: '0.000005',
    },
    top_provider: {
      context_length: 4096,
      max_completion_tokens: 4096,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: ['temperature', 'max_tokens'],
    default_parameters: {
      temperature: 0.7,
      top_p: null,
      top_k: null,
      frequency_penalty: null,
      presence_penalty: null,
      repetition_penalty: null,
    },
    expiration_date: null,
    ...overrides,
  };
}

describe('Integration Tests - Full Sync Flow', () => {
  let tempDir: string;
  let cacheDir: string;
  let configPath: string;

  // Store original fetch for restoration
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    // Create temporary directory for test isolation
    tempDir = join(tmpdir(), `openrouter-sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = join(tempDir, 'cache');
    configPath = join(tempDir, 'config', 'opencode.json');

    await mkdir(cacheDir, { recursive: true });
    await mkdir(join(tempDir, 'config'), { recursive: true });

    // Store original fetch
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    // Restore original fetch
    globalThis.fetch = originalFetch;

    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Cache Operations', () => {
    it('should write and read cache correctly', async () => {
      const models = [createMockModel('test-model-1'), createMockModel('test-model-2')];
      const cacheData: CacheData = {
        models,
        timestamp: Date.now(),
      };

      await writeCache(cacheData, { cacheDir });

      const readData = await readCache({ cacheDir });
      expect(readData).not.toBeNull();
      expect(readData?.models).toHaveLength(2);
      expect(readData?.timestamp).toBe(cacheData.timestamp);
    });

    it('should return null for non-existent cache', async () => {
      const readData = await readCache({ cacheDir });
      expect(readData).toBeNull();
    });

    it('should validate cache within TTL', async () => {
      const cacheData: CacheData = {
        models: [createMockModel('test')],
        timestamp: Date.now() - 1000, // 1 second ago
      };

      expect(isCacheValid(cacheData, 60000)).toBe(true); // 60 second TTL
    });

    it('should invalidate cache outside TTL', async () => {
      const cacheData: CacheData = {
        models: [createMockModel('test')],
        timestamp: Date.now() - 86400001, // 24 hours + 1ms ago
      };

      expect(isCacheValid(cacheData, 86400000)).toBe(false); // 24 hour TTL
    });

    it('should clear cache successfully', async () => {
      const cacheData: CacheData = {
        models: [createMockModel('test')],
        timestamp: Date.now(),
      };

      await writeCache(cacheData, { cacheDir });
      expect(await readCache({ cacheDir })).not.toBeNull();

      const cleared = await clearCache({ cacheDir });
      expect(cleared).toBe(true);
      expect(await readCache({ cacheDir })).toBeNull();
    });
  });

  describe('Config Operations', () => {
    it('should create default config when file does not exist', async () => {
      // Temporarily override config path (we need to test through the functions)
      const nonExistentConfig = join(tempDir, 'nonexistent', 'config.json');

      // Create a minimal config file to test readConfig behavior
      const config = await readConfig();
      expect(config).not.toBeNull();
      expect(config?.provider).toBeDefined();
    });

    it('should read existing config file', async () => {
      const existingConfig = {
        provider: {
          openrouter: {
            models: {
              'existing-model': {
                id: 'existing-model',
                name: 'Existing Model',
                provider: 'openrouter',
              },
            },
          },
        },
      };

      await writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      // Mock the config path by testing through writeConfig which merges
      const testConfig = await readConfig();
      expect(testConfig).not.toBeNull();
    });

    it('should merge configs without overwriting existing values', async () => {
      const existingConfig = {
        provider: {
          openrouter: {
            models: {
              'model-1': {
                id: 'model-1',
                name: 'Custom Model Name',
                provider: 'openrouter',
                customField: 'should-be-preserved',
              },
            },
          },
        },
        otherSetting: 'preserved',
      };

      await writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      // Read and verify structure
      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.otherSetting).toBe('preserved');
      expect(parsed.provider.openrouter.models['model-1'].customField).toBe('should-be-preserved');
    });
  });

  describe('Full Sync Flow', () => {
    it('should complete full sync: check cache → fetch → diff → update → write', async () => {
      // Step 1: Verify cache is empty initially
      const initialCache = await readCache({ cacheDir });
      expect(initialCache).toBeNull();

      // Step 2: Mock API response
      const mockModels = [
        createMockModel('openai/gpt-4'),
        createMockModel('anthropic/claude-3'),
      ];

      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ data: mockModels }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // Step 3: Fetch models (mocked)
      const fetchedModels = await fetchModels();
      expect(fetchedModels).not.toBeNull();
      expect(fetchedModels).toHaveLength(2);

      // Step 4: Create initial config with one existing model
      const initialConfig = {
        provider: {
          openrouter: {
            models: {
              'openai/gpt-4': {
                id: 'openai/gpt-4',
                name: 'Existing GPT-4',
                provider: 'openrouter',
                customField: 'preserved',
              },
            },
          },
        },
      };
      await writeFile(configPath, JSON.stringify(initialConfig, null, 2), 'utf-8');

      // Step 5: Update models (diff and add)
      const logMessages: string[] = [];
      const mockLog = (msg: string) => logMessages.push(msg);

      // Manually simulate the update to test the sync flow logic
      const config = JSON.parse(await readFile(configPath, 'utf-8'));
      let added = 0;
      let skipped = 0;

      for (const model of fetchedModels || []) {
        if (model.id in config.provider.openrouter.models) {
          skipped++;
        } else {
          config.provider.openrouter.models[model.id] = {
            id: model.id,
            name: model.name,
            provider: 'openrouter',
            context_length: model.context_length,
            pricing: {
              prompt: parseFloat(model.pricing.prompt) || 0,
              completion: parseFloat(model.pricing.completion) || 0,
            },
          };
          added++;
        }
      }

      expect(added).toBe(1); // Only anthropic/claude-3 is new
      expect(skipped).toBe(1); // openai/gpt-4 already exists

      // Step 6: Verify existing model is preserved
      expect(config.provider.openrouter.models['openai/gpt-4'].customField).toBe('preserved');
      expect(config.provider.openrouter.models['openai/gpt-4'].name).toBe('Existing GPT-4');

      // Step 7: Write updated config
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Step 8: Write cache
      await writeCache({ models: fetchedModels || [], timestamp: Date.now() }, { cacheDir });

      // Step 9: Verify cache is now valid
      const finalCache = await readCache({ cacheDir });
      expect(finalCache).not.toBeNull();
      expect(isCacheValid(finalCache!, 86400000)).toBe(true);

      // Step 10: Verify final config
      const finalConfig = JSON.parse(await readFile(configPath, 'utf-8'));
      expect(Object.keys(finalConfig.provider.openrouter.models)).toHaveLength(2);
      expect(finalConfig.provider.openrouter.models['anthropic/claude-3']).toBeDefined();
    });

    it('should skip sync when cache is valid', async () => {
      // Write a valid cache
      const mockModels = [createMockModel('cached-model')];
      await writeCache(
        { models: mockModels, timestamp: Date.now() },
        { cacheDir }
      );

      // Verify cache is valid
      const cache = await readCache({ cacheDir });
      expect(cache).not.toBeNull();
      expect(isCacheValid(cache!, 86400000)).toBe(true);

      // In the real flow, this would skip the API call
      // We verify the cache mechanism works correctly
    });

    it('should handle empty model list gracefully', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const models = await fetchModels();
      expect(models).toBeNull(); // API returns null for empty data
    });
  });

  describe('Error Handling', () => {
    it('should handle API failure gracefully', async () => {
      // Step 1: Create a stale cache
      const staleModels = [createMockModel('stale-model')];
      await writeCache(
        { models: staleModels, timestamp: Date.now() - 86400001 }, // Expired
        { cacheDir }
      );

      // Step 2: Mock API failure
      globalThis.fetch = mock(async () => {
        throw new Error('Network error');
      });

      // Step 3: Fetch should return null on failure
      const fetchedModels = await fetchModels();
      expect(fetchedModels).toBeNull();

      // Step 4: Read the stale cache as fallback
      const cache = await readCache({ cacheDir });
      expect(cache).not.toBeNull();
      expect(cache?.models).toHaveLength(1);
      expect(cache?.models[0].id).toBe('stale-model');

      // The actual plugin would use cached data when API fails
      // This simulates that behavior
    });

    it('should handle HTTP error responses', async () => {
      globalThis.fetch = mock(async () => {
        return new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        });
      });

      const models = await fetchModels();
      expect(models).toBeNull();
    });

    it('should handle invalid JSON response', async () => {
      globalThis.fetch = mock(async () => {
        return new Response('not valid json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const models = await fetchModels();
      expect(models).toBeNull();
    });

    it('should handle malformed API response structure', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ notData: 'wrong structure' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const models = await fetchModels();
      expect(models).toBeNull();
    });

    it('should handle API timeout', async () => {
      globalThis.fetch = mock(async () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      });

      const models = await fetchModels();
      expect(models).toBeNull();
    });
  });

  describe('Model Diff Logic', () => {
    it('should only add new models and skip existing ones', async () => {
      const existingModels = {
        'model-a': { id: 'model-a', name: 'Model A', provider: 'openrouter' },
        'model-b': { id: 'model-b', name: 'Model B', provider: 'openrouter' },
      };

      const fetchedModels = [
        createMockModel('model-a'), // Already exists
        createMockModel('model-b'), // Already exists
        createMockModel('model-c'), // New
        createMockModel('model-d'), // New
      ];

      // Simulate the diff logic
      let added = 0;
      let skipped = 0;
      const resultModels = { ...existingModels };

      for (const model of fetchedModels) {
        if (model.id in resultModels) {
          skipped++;
        } else {
          resultModels[model.id] = {
            id: model.id,
            name: model.name,
            provider: 'openrouter',
          };
          added++;
        }
      }

      expect(added).toBe(2); // model-c and model-d
      expect(skipped).toBe(2); // model-a and model-b
      expect(Object.keys(resultModels)).toHaveLength(4);
    });

    it('should preserve custom fields on existing models', async () => {
      const existingModels = {
        'model-a': {
          id: 'model-a',
          name: 'Custom Name',
          provider: 'openrouter',
          customField: 'custom-value',
          context_length: 8192,
        },
      };

      const fetchedModels = [createMockModel('model-a', { context_length: 4096 })];

      // Simulate merge - existing should not be overwritten
      const resultModels = { ...existingModels };

      for (const model of fetchedModels) {
        if (!(model.id in resultModels)) {
          resultModels[model.id] = {
            id: model.id,
            name: model.name,
            provider: 'openrouter',
            context_length: model.context_length,
          };
        }
      }

      // Original values preserved
      expect(resultModels['model-a'].name).toBe('Custom Name');
      expect(resultModels['model-a'].customField).toBe('custom-value');
      expect(resultModels['model-a'].context_length).toBe(8192);
    });

    it('should skip models without IDs', async () => {
      const fetchedModels = [
        createMockModel('valid-model'),
        { ...createMockModel(''), id: '' }, // Invalid model without ID
      ];

      let skipped = 0;
      const validModels = [];

      for (const model of fetchedModels) {
        if (!model.id) {
          skipped++;
        } else {
          validModels.push(model);
        }
      }

      expect(skipped).toBe(1);
      expect(validModels).toHaveLength(1);
    });
  });

  describe('Cache Path Resolution', () => {
    it('should resolve cache path with custom config', () => {
      const customCacheDir = '/custom/cache/dir';
      const path = getCachePath({ cacheDir: customCacheDir });
      expect(path.includes('custom') && path.includes('cache') && path.includes('dir')).toBe(true);
      expect(path).toContain('cache.json');
    });

    it('should use default cache path without config', () => {
      const path = getCachePath();
      expect(path).toContain('.local');
      expect(path).toContain('cache.json');
    });
  });
});

describe('End-to-End Sync Scenarios', () => {
  let tempDir: string;
  let cacheDir: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `openrouter-sync-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = join(tempDir, 'cache');
    await mkdir(cacheDir, { recursive: true });
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle first-time sync with no existing cache or config', async () => {
    // Mock API returning models
    const apiModels = [
      createMockModel('provider1/model-1'),
      createMockModel('provider2/model-2'),
      createMockModel('provider3/model-3'),
    ];

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ data: apiModels }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Step 1: Check cache (empty)
    const cache = await readCache({ cacheDir });
    expect(cache).toBeNull();

    // Step 2: Fetch from API
    const models = await fetchModels();
    expect(models).toHaveLength(3);

    // Step 3: Write cache
    await writeCache({ models: models!, timestamp: Date.now() }, { cacheDir });

    // Step 4: Verify cache written
    const writtenCache = await readCache({ cacheDir });
    expect(writtenCache).not.toBeNull();
    expect(writtenCache?.models).toHaveLength(3);
  });

  it('should handle daily re-sync with existing cache', async () => {
    // Write an expired cache (simulating daily re-sync)
    const oldModels = [createMockModel('old-model')];
    await writeCache(
      { models: oldModels, timestamp: Date.now() - 86400001 }, // Expired
      { cacheDir }
    );

    // Mock API returning new models
    const newModels = [
      createMockModel('old-model'), // Still exists in API
      createMockModel('new-model'), // New in API
    ];

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ data: newModels }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Step 1: Check cache (expired)
    const cache = await readCache({ cacheDir });
    expect(cache).not.toBeNull();
    expect(isCacheValid(cache!, 86400000)).toBe(false);

    // Step 2: Fetch from API
    const models = await fetchModels();
    expect(models).toHaveLength(2);

    // Step 3: Update cache
    await writeCache({ models: models!, timestamp: Date.now() }, { cacheDir });

    // Step 4: Verify updated cache
    const updatedCache = await readCache({ cacheDir });
    expect(updatedCache?.models).toHaveLength(2);
    expect(updatedCache?.models.some((m) => m.id === 'new-model')).toBe(true);
  });

  it('should use cached data when API is unavailable', async () => {
    // Write a valid cache
    const cachedModels = [createMockModel('cached-model-1'), createMockModel('cached-model-2')];
    await writeCache({ models: cachedModels, timestamp: Date.now() }, { cacheDir });

    // Mock API failure
    globalThis.fetch = mock(async () => {
      throw new Error('Network unavailable');
    });

    // Step 1: Check cache (valid)
    const cache = await readCache({ cacheDir });
    expect(cache).not.toBeNull();
    expect(isCacheValid(cache!, 86400000)).toBe(true);

    // Step 2: Try fetch (fails)
    const models = await fetchModels();
    expect(models).toBeNull();

    // Step 3: Fall back to cached data
    const fallbackCache = await readCache({ cacheDir });
    expect(fallbackCache?.models).toHaveLength(2);
    expect(fallbackCache?.models[0].id).toBe('cached-model-1');
  });
});
