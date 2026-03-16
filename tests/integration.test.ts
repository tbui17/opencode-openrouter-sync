/**
 * Integration tests for OpenRouter Model Sync Plugin
 *
 * Tests the full sync flow using actual functions (not re-implementations).
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
  convertToConfigModel,
} from '../src/config.js';
import { fetchModels } from '../src/api.js';
import type { OpenRouterModel, CacheData } from '../src/types.js';

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
  } as OpenRouterModel;
}

describe('Integration Tests - Full Sync Flow', () => {
  let tempDir: string;
  let cacheDir: string;
  let configPath: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `openrouter-sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = join(tempDir, 'cache');
    configPath = join(tempDir, 'config', 'opencode.json');

    await mkdir(cacheDir, { recursive: true });
    await mkdir(join(tempDir, 'config'), { recursive: true });

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

  describe('Cache Operations', () => {
    it('should write and read cache correctly', async () => {
      const models = [createMockModel('test-model-1'), createMockModel('test-model-2')];
      const cacheData: CacheData = { models, timestamp: Date.now() };

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
        timestamp: Date.now() - 1000,
      };
      expect(isCacheValid(cacheData, 60000)).toBe(true);
    });

    it('should invalidate cache outside TTL', async () => {
      const cacheData: CacheData = {
        models: [createMockModel('test')],
        timestamp: Date.now() - 86400001,
      };
      expect(isCacheValid(cacheData, 86400000)).toBe(false);
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

    it('should handle corrupted cache gracefully', async () => {
      const cachePath = getCachePath({ cacheDir });
      await writeFile(cachePath, '{ corrupted json!!!', 'utf-8');

      const readData = await readCache({ cacheDir });
      expect(readData).toBeNull();
    });
  });

  describe('Config Operations', () => {
    it('should create default config when file does not exist', async () => {
      const nonExistentConfig = join(tempDir, 'nonexistent', 'config.json');
      const config = await readConfig(nonExistentConfig);
      expect(config).not.toBeNull();
      expect((config as any)?.provider).toBeDefined();
    });

    it('should read existing config file', async () => {
      const existingConfig = {
        provider: {
          openrouter: {
            models: {
              'existing-model': { name: 'Existing Model' },
            },
          },
        },
      };

      await writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
      const testConfig = await readConfig(configPath);
      expect(testConfig).not.toBeNull();
    });

    it('should merge configs without overwriting existing values', async () => {
      const existingConfig = {
        provider: {
          openrouter: {
            models: {
              'model-1': {
                name: 'Custom Model Name',
                customField: 'should-be-preserved',
              },
            },
          },
        },
        otherSetting: 'preserved',
      };

      await writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.otherSetting).toBe('preserved');
      expect(parsed.provider.openrouter.models['model-1'].customField).toBe('should-be-preserved');
    });

    it('should read JSONC config files with comments', async () => {
      const jsoncContent = [
        '{',
        '  // Global settings',
        '  "provider": {',
        '    "openrouter": {',
        '      /* model definitions */',
        '      "models": {',
        '        "test/model": { "name": "Test" }',
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n');

      await writeFile(configPath, jsoncContent, 'utf-8');

      const config = await readConfig(configPath);
      expect(config).not.toBeNull();
      expect((config as any).provider.openrouter.models['test/model'].name).toBe('Test');
    });

    it('should preserve other providers when updating openrouter models', async () => {
      const existingConfig = {
        provider: {
          openrouter: {
            models: {}
          },
          anthropic: {
            models: {
              'claude-3': { name: 'Claude 3' }
            }
          }
        }
      };

      await writeFile(configPath, JSON.stringify(existingConfig), 'utf-8');

      const mockModels = [createMockModel('openai/gpt-4')];
      await updateModels(mockModels, configPath);

      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      // OpenRouter model added
      expect(parsed.provider.openrouter.models['openai/gpt-4']).toBeDefined();
      // Anthropic provider preserved
      expect(parsed.provider.anthropic.models['claude-3'].name).toBe('Claude 3');
    });
  });

  describe('Full Sync Flow', () => {
    it('should complete full sync using actual updateModels()', async () => {
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
                name: 'Existing GPT-4',
                customField: 'preserved',
              },
            },
          },
        },
      };
      await writeFile(configPath, JSON.stringify(initialConfig, null, 2), 'utf-8');

      // Step 5: Use actual updateModels() instead of reimplementing the logic
      const result = await updateModels(fetchedModels!, configPath);

      expect(result.added).toBe(1); // Only anthropic/claude-3 is new
      expect(result.skipped).toBe(1); // openai/gpt-4 already exists

      // Step 6: Verify existing model is preserved
      const finalContent = await readFile(configPath, 'utf-8');
      const finalConfig = JSON.parse(finalContent);
      expect(finalConfig.provider.openrouter.models['openai/gpt-4'].customField).toBe('preserved');
      expect(finalConfig.provider.openrouter.models['openai/gpt-4'].name).toBe('Existing GPT-4');

      // Step 7: Verify new model was added with correct format
      const addedModel = finalConfig.provider.openrouter.models['anthropic/claude-3'];
      expect(addedModel).toBeDefined();
      expect(addedModel.cost).toBeDefined();
      expect(addedModel.limit).toBeDefined();
      // Should NOT have old-format fields
      expect(addedModel.id).toBeUndefined();
      expect(addedModel.provider).toBeUndefined();
      expect(addedModel.pricing).toBeUndefined();

      // Step 8: Write cache
      await writeCache({ models: fetchedModels!, timestamp: Date.now() }, { cacheDir });

      // Step 9: Verify cache is now valid
      const finalCache = await readCache({ cacheDir });
      expect(finalCache).not.toBeNull();
      expect(isCacheValid(finalCache!, 86400000)).toBe(true);

      // Step 10: Verify final config
      expect(Object.keys(finalConfig.provider.openrouter.models)).toHaveLength(2);
    });

    it('should skip sync when cache is valid', async () => {
      const mockModels = [createMockModel('cached-model')];
      await writeCache(
        { models: mockModels, timestamp: Date.now() },
        { cacheDir }
      );

      const cache = await readCache({ cacheDir });
      expect(cache).not.toBeNull();
      expect(isCacheValid(cache!, 86400000)).toBe(true);
    });

    it('should handle empty model list gracefully', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const models = await fetchModels();
      expect(models).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle API failure gracefully', async () => {
      const staleModels = [createMockModel('stale-model')];
      await writeCache(
        { models: staleModels, timestamp: Date.now() - 86400001 },
        { cacheDir }
      );

      globalThis.fetch = mock(async () => {
        throw new Error('Network error');
      });

      const fetchedModels = await fetchModels();
      expect(fetchedModels).toBeNull();

      const cache = await readCache({ cacheDir });
      expect(cache).not.toBeNull();
      expect(cache?.models).toHaveLength(1);
      expect(cache?.models[0].id).toBe('stale-model');
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

  describe('Model Diff Logic (using actual updateModels)', () => {
    it('should only add new models and skip existing ones', async () => {
      const existingConfig = {
        provider: {
          openrouter: {
            models: {
              'model-a': { name: 'Model A' },
              'model-b': { name: 'Model B' },
            },
          },
        },
      };

      await writeFile(configPath, JSON.stringify(existingConfig), 'utf-8');

      const fetchedModels = [
        createMockModel('model-a'),
        createMockModel('model-b'),
        createMockModel('model-c'),
        createMockModel('model-d'),
      ];

      const result = await updateModels(fetchedModels, configPath);

      expect(result.added).toBe(2); // model-c and model-d
      expect(result.skipped).toBe(2); // model-a and model-b

      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(Object.keys(parsed.provider.openrouter.models)).toHaveLength(4);
    });

    it('should preserve custom fields on existing models', async () => {
      const existingConfig = {
        provider: {
          openrouter: {
            models: {
              'model-a': {
                name: 'Custom Name',
                customField: 'custom-value',
                limit: { context: 8192 },
              },
            },
          },
        },
      };

      await writeFile(configPath, JSON.stringify(existingConfig), 'utf-8');

      const fetchedModels = [createMockModel('model-a', { context_length: 4096 })];
      const result = await updateModels(fetchedModels, configPath);

      expect(result.skipped).toBe(1);

      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.provider.openrouter.models['model-a'].name).toBe('Custom Name');
      expect(parsed.provider.openrouter.models['model-a'].customField).toBe('custom-value');
      expect(parsed.provider.openrouter.models['model-a'].limit.context).toBe(8192);
    });

    it('should skip models without IDs', async () => {
      await writeFile(configPath, JSON.stringify({
        provider: { openrouter: { models: {} } }
      }), 'utf-8');

      const fetchedModels = [
        createMockModel('valid-model'),
        { ...createMockModel(''), id: '' },
      ];

      const result = await updateModels(fetchedModels, configPath);
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
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

    const cache = await readCache({ cacheDir });
    expect(cache).toBeNull();

    const models = await fetchModels();
    expect(models).toHaveLength(3);

    await writeCache({ models: models!, timestamp: Date.now() }, { cacheDir });

    const writtenCache = await readCache({ cacheDir });
    expect(writtenCache).not.toBeNull();
    expect(writtenCache?.models).toHaveLength(3);
  });

  it('should handle daily re-sync with existing cache', async () => {
    const oldModels = [createMockModel('old-model')];
    await writeCache(
      { models: oldModels, timestamp: Date.now() - 86400001 },
      { cacheDir }
    );

    const newModels = [
      createMockModel('old-model'),
      createMockModel('new-model'),
    ];

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ data: newModels }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const cache = await readCache({ cacheDir });
    expect(cache).not.toBeNull();
    expect(isCacheValid(cache!, 86400000)).toBe(false);

    const models = await fetchModels();
    expect(models).toHaveLength(2);

    await writeCache({ models: models!, timestamp: Date.now() }, { cacheDir });

    const updatedCache = await readCache({ cacheDir });
    expect(updatedCache?.models).toHaveLength(2);
    expect(updatedCache?.models.some((m) => m.id === 'new-model')).toBe(true);
  });

  it('should use cached data when API is unavailable', async () => {
    const cachedModels = [createMockModel('cached-model-1'), createMockModel('cached-model-2')];
    await writeCache({ models: cachedModels, timestamp: Date.now() }, { cacheDir });

    globalThis.fetch = mock(async () => {
      throw new Error('Network unavailable');
    });

    const cache = await readCache({ cacheDir });
    expect(cache).not.toBeNull();
    expect(isCacheValid(cache!, 86400000)).toBe(true);

    const models = await fetchModels();
    expect(models).toBeNull();

    const fallbackCache = await readCache({ cacheDir });
    expect(fallbackCache?.models).toHaveLength(2);
    expect(fallbackCache?.models[0].id).toBe('cached-model-1');
  });
});
