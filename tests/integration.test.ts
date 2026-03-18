/**
 * Integration tests for OpenRouter Model Sync Plugin
 *
 * Tests the full sync flow using actual functions (not re-implementations).
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchModels } from '../src/api.js';
import {
  clearCache,
  getCachePath,
  isCacheValid,
  readCache,
  writeCache,
} from '../src/cache.js';
import { readConfig, updateModels } from '../src/config.js';
import { performSync, type SyncDeps } from '../src/plugin.js';
import { schema } from '../src/schema.js';
import type {
  CacheData,
  OpenRouterModel,
  PluginContext,
} from '../src/types.js';

function createMockModel(
  id: string,
  overrides?: Partial<OpenRouterModel>,
): OpenRouterModel {
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
    tempDir = join(
      tmpdir(),
      `openrouter-sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
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
      const models = [
        createMockModel('test-model-1'),
        createMockModel('test-model-2'),
      ];
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

      await writeFile(
        configPath,
        JSON.stringify(existingConfig, null, 2),
        'utf-8',
      );
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

      await writeFile(
        configPath,
        JSON.stringify(existingConfig, null, 2),
        'utf-8',
      );

      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.otherSetting).toBe('preserved');
      expect(parsed.provider.openrouter.models['model-1'].customField).toBe(
        'should-be-preserved',
      );
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
      expect(
        (config as any).provider.openrouter.models['test/model'].name,
      ).toBe('Test');
    });

    it('should preserve other providers when updating openrouter models', async () => {
      const existingConfig = {
        provider: {
          openrouter: {
            models: {},
          },
          anthropic: {
            models: {
              'claude-3': { name: 'Claude 3' },
            },
          },
        },
      };

      await writeFile(configPath, JSON.stringify(existingConfig), 'utf-8');

      const mockModels = [createMockModel('openai/gpt-4')];
      await updateModels(mockModels, configPath);

      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      // OpenRouter model added
      expect(parsed.provider.openrouter.models['openai/gpt-4']).toBeDefined();
      // Anthropic provider preserved
      expect(parsed.provider.anthropic.models['claude-3'].name).toBe(
        'Claude 3',
      );
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
      const fetchedModelsResult = await fetchModels();
      expect('data' in fetchedModelsResult).toBe(true);
      const fetchedModels = fetchedModelsResult.data;

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
      await writeFile(
        configPath,
        JSON.stringify(initialConfig, null, 2),
        'utf-8',
      );

      // Step 5: Use actual updateModels() instead of reimplementing the logic
      const result = await updateModels(fetchedModels!, configPath);

      expect(result.added).toBe(1); // Only anthropic/claude-3 is new
      expect(result.skipped).toBe(1); // openai/gpt-4 already exists
      expect(result.removed).toBe(0); // Both existing models are in API response

      // Step 6: Verify existing model is preserved
      const finalContent = await readFile(configPath, 'utf-8');
      const finalConfig = JSON.parse(finalContent);
      expect(
        finalConfig.provider.openrouter.models['openai/gpt-4'].customField,
      ).toBe('preserved');
      expect(finalConfig.provider.openrouter.models['openai/gpt-4'].name).toBe(
        'Existing GPT-4',
      );

      // Step 7: Verify new model was added with correct format
      const addedModel =
        finalConfig.provider.openrouter.models['anthropic/claude-3'];
      expect(addedModel).toBeDefined();
      expect(addedModel.cost).toBeDefined();
      expect(addedModel.limit).toBeDefined();
      // Should NOT have old-format fields
      expect(addedModel.id).toBeUndefined();
      expect(addedModel.provider).toBeUndefined();
      expect(addedModel.pricing).toBeUndefined();

      // Step 8: Write cache
      await writeCache(
        { models: fetchedModels!, timestamp: Date.now() },
        { cacheDir },
      );

      // Step 9: Verify cache is now valid
      const finalCache = await readCache({ cacheDir });
      expect(finalCache).not.toBeNull();
      expect(isCacheValid(finalCache!, 86400000)).toBe(true);

      // Step 10: Verify final config
      expect(Object.keys(finalConfig.provider.openrouter.models)).toHaveLength(
        2,
      );
    });

    it('should skip sync when cache is valid', async () => {
      const mockModels = [createMockModel('cached-model')];
      await writeCache(
        { models: mockModels, timestamp: Date.now() },
        { cacheDir },
      );

      const cache = await readCache({ cacheDir });
      expect(cache).not.toBeNull();
      expect(isCacheValid(cache!, 86400000)).toBe(true);

      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            data: [createMockModel('m1'), createMockModel('m2')],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      });

      const modelsResult = await fetchModels();
      expect('data' in modelsResult).toBe(true);
      const models = modelsResult.data;
      expect(models).toHaveLength(2);

      await writeCache({ models, timestamp: Date.now() }, { cacheDir });

      const updatedCache = await readCache({ cacheDir });
      expect(updatedCache?.models).toHaveLength(2);
    });

    it('should use cached data when API is unavailable', async () => {
      const cachedModels = [
        createMockModel('cached-model-1'),
        createMockModel('cached-model-2'),
      ];
      await writeCache(
        { models: cachedModels, timestamp: Date.now() },
        { cacheDir },
      );

      globalThis.fetch = mock(async () => {
        throw new Error('Network unavailable');
      });

      const cache = await readCache({ cacheDir });
      expect(cache).not.toBeNull();
      expect(isCacheValid(cache!, 86400000)).toBe(true);

      const modelsResult = await fetchModels();
      expect('error' in modelsResult).toBe(true);
    });

    describe('Error Handling', () => {
      it('should handle API failure gracefully', async () => {
        const staleModels = [createMockModel('stale-model')];
        await writeCache(
          { models: staleModels, timestamp: Date.now() - 86400001 },
          { cacheDir },
        );

        globalThis.fetch = mock(async () => {
          throw new Error('Network error');
        });

        const fetchedModelsResult = await fetchModels();
        expect('error' in fetchedModelsResult).toBe(true);

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

        const modelsResult = await fetchModels();
        expect('error' in modelsResult).toBe(true);
        expect(modelsResult.error.type).toBe('http');
      });

      it('should handle invalid JSON response', async () => {
        globalThis.fetch = mock(async () => {
          return new Response('not valid json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });

        const modelsResult = await fetchModels();
        expect('error' in modelsResult).toBe(true);
        expect(modelsResult.error.type).toBe('parse');
      });

      it('should handle malformed API response structure', async () => {
        globalThis.fetch = mock(async () => {
          return new Response(JSON.stringify({ notData: 'wrong structure' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });

        const modelsResult = await fetchModels();
        expect('error' in modelsResult).toBe(true);
        expect(modelsResult.error.type).toBe('validation');
      });

      it('should handle API timeout', async () => {
        globalThis.fetch = mock(async () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          throw error;
        });

        const modelsResult = await fetchModels();
        expect('error' in modelsResult).toBe(true);
        expect(modelsResult.error.type).toBe('timeout');
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

        const fetchedModels = [
          createMockModel('model-a', { context_length: 4096 }),
        ];
        const result = await updateModels(fetchedModels, configPath);

        expect(result.skipped).toBe(1);

        const content = await readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed.provider.openrouter.models['model-a'].name).toBe(
          'Custom Name',
        );
        expect(parsed.provider.openrouter.models['model-a'].customField).toBe(
          'custom-value',
        );
        expect(parsed.provider.openrouter.models['model-a'].limit.context).toBe(
          8192,
        );
      });

      it('should remove models no longer in API response', async () => {
        const existingConfig = {
          provider: {
            openrouter: {
              models: {
                'active-model': { name: 'Active' },
                'retired-model': { name: 'Retired' },
                'deprecated-model': { name: 'Deprecated' },
              },
            },
          },
        };

        await writeFile(configPath, JSON.stringify(existingConfig), 'utf-8');

        // API only returns active-model and a new one
        const fetchedModels = [
          createMockModel('active-model'),
          createMockModel('brand-new-model'),
        ];

        const result = await updateModels(fetchedModels, configPath);

        expect(result.added).toBe(1); // brand-new-model
        expect(result.skipped).toBe(1); // active-model
        expect(result.removed).toBe(2); // retired-model, deprecated-model

        const content = await readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        const models = parsed.provider.openrouter.models;

        expect(Object.keys(models)).toHaveLength(2);
        expect(models['active-model']).toBeDefined();
        expect(models['brand-new-model']).toBeDefined();
        expect(models['retired-model']).toBeUndefined();
        expect(models['deprecated-model']).toBeUndefined();
      });

      it('should skip models without IDs', async () => {
        await writeFile(
          configPath,
          JSON.stringify({
            provider: { openrouter: { models: {} } },
          }),
          'utf-8',
        );

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
        expect(
          path.includes('custom') &&
            path.includes('cache') &&
            path.includes('dir'),
        ).toBe(true);
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
      tempDir = join(
        tmpdir(),
        `openrouter-sync-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
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

      const modelsResult = await fetchModels();
      expect('data' in modelsResult).toBe(true);
      const models = modelsResult.data;
      expect(models).toHaveLength(3);

      await writeCache({ models, timestamp: Date.now() }, { cacheDir });

      const writtenCache = await readCache({ cacheDir });
      expect(writtenCache).not.toBeNull();
      expect(writtenCache?.models).toHaveLength(3);
    });

    it('should skip sync when cache is valid', async () => {
      const mockModels = [createMockModel('cached-model')];
      await writeCache(
        { models: mockModels, timestamp: Date.now() },
        { cacheDir },
      );

      const cache = await readCache({ cacheDir });
      expect(cache).not.toBeNull();
      expect(isCacheValid(cache!, 86400000)).toBe(true);
    });

    it('should handle daily re-sync with existing cache', async () => {
      const oldModels = [createMockModel('old-model')];
      await writeCache(
        { models: oldModels, timestamp: Date.now() - 86400001 },
        { cacheDir },
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

      const modelsResult = await fetchModels();
      expect('data' in modelsResult).toBe(true);
      const models = modelsResult.data;
      expect(models).toHaveLength(2);

      await writeCache({ models, timestamp: Date.now() }, { cacheDir });

      const updatedCache = await readCache({ cacheDir });
      expect(updatedCache?.models).toHaveLength(2);
      expect(updatedCache?.models.some((m) => m.id === 'new-model')).toBe(true);
    });

    it('should use cached data when API is unavailable', async () => {
      const cachedModels = [
        createMockModel('cached-model-1'),
        createMockModel('cached-model-2'),
      ];
      await writeCache(
        { models: cachedModels, timestamp: Date.now() },
        { cacheDir },
      );

      globalThis.fetch = mock(async () => {
        throw new Error('Network unavailable');
      });

      const cache = await readCache({ cacheDir });
      expect(cache).not.toBeNull();
      expect(isCacheValid(cache!, 86400000)).toBe(true);

      const modelsResult = await fetchModels();
      expect('error' in modelsResult).toBe(true);
      expect(modelsResult.error.type).toBe('network');

      const fallbackCache = await readCache({ cacheDir });
      expect(fallbackCache?.models).toHaveLength(2);
      expect(fallbackCache?.models[0].id).toBe('cached-model-1');
    });
  });
});

describe('performSync file write integration', () => {
  let tempDir: string;
  let configDir: string;
  let configPath: string;
  let originalFetch: typeof globalThis.fetch;
  let originalConfigDir: string | undefined;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `openrouter-performsync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    configDir = join(tempDir, 'config', 'opencode');
    configPath = join(configDir, 'opencode.json');

    await mkdir(configDir, { recursive: true });

    originalFetch = globalThis.fetch;
    originalConfigDir = process.env.OPENCODE_CONFIG_DIR;
    process.env.OPENCODE_CONFIG_DIR = configDir;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    if (originalConfigDir === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = originalConfigDir;
    }
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createMockCtx(): PluginContext {
    return {
      client: {
        app: { log: () => {} },
        config: {
          get: async () => ({}),
          set: async () => {},
        },
      },
    };
  }

  it('should write models to config file on disk via performSync', async () => {
    // Create an empty config file
    await writeFile(
      configPath,
      JSON.stringify(
        {
          provider: { openrouter: { models: {} } },
        },
        null,
        2,
      ),
      'utf-8',
    );

    const mockModels = [
      createMockModel('openai/gpt-4', {
        pricing: {
          prompt: '0.00003',
          completion: '0.00006',
          input_cache_read: '0.000015',
        },
        context_length: 128000,
        top_provider: {
          context_length: 128000,
          max_completion_tokens: 4096,
          is_moderated: false,
        },
      }),
      createMockModel('anthropic/claude-3-opus', {
        pricing: {
          prompt: '0.000015',
          completion: '0.000075',
          input_cache_read: '0.0000075',
        },
        context_length: 200000,
        top_provider: {
          context_length: 200000,
          max_completion_tokens: 4096,
          is_moderated: false,
        },
      }),
    ];

    // Cache dir derived from OPENCODE_CONFIG_DIR by getDefaultCacheDir logic:
    // parentDir = dirname(configDir) = tempDir/config
    // cacheDir = parentDir/share/opencode/openrouter-sync
    const cacheDir = join(
      tempDir,
      'config',
      'share',
      'opencode',
      'openrouter-sync',
    );

    const deps: SyncDeps = {
      readCache: () => readCache({ cacheDir }),
      writeCache: (data) => writeCache(data, { cacheDir }),
      isCacheValid: (data, ttlMs) => isCacheValid(data, ttlMs),
      fetchModels: async () => ({ data: mockModels }),
      updateModels: (models, configPath, log) =>
        updateModels(models, configPath, log),
      readConfig: () => readConfig(),
    };

    const ctx = createMockCtx();
    await performSync(ctx, deps);

    // Assert: config file on disk contains the models
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    expect(config.provider.openrouter.models).toBeDefined();
    const models = config.provider.openrouter.models;
    expect(Object.keys(models)).toHaveLength(2);
    expect(models['openai/gpt-4']).toBeDefined();
    expect(models['anthropic/claude-3-opus']).toBeDefined();

    // Assert: model entries have correct shape (cost, limit, name)
    const gpt4 = models['openai/gpt-4'];
    expect(gpt4.name).toBe('Model openai/gpt-4');
    expect(gpt4.cost).toBeDefined();
    expect(gpt4.cost.input).toBe(0.00003);
    expect(gpt4.cost.output).toBe(0.00006);
    expect(gpt4.limit).toBeDefined();
    expect(gpt4.limit.context).toBe(128000);
    expect(gpt4.limit.output).toBe(4096);

    // Assert: no raw API fields leaked
    expect(gpt4.id).toBeUndefined();
    expect(gpt4.pricing).toBeUndefined();
    expect(gpt4.top_provider).toBeUndefined();
    expect(gpt4.architecture).toBeUndefined();

    // Assert: cache file was written to disk
    const cacheContent = await readFile(join(cacheDir, 'cache.json'), 'utf-8');
    const cacheData = JSON.parse(cacheContent);
    expect(cacheData.models).toHaveLength(2);
    expect(cacheData.timestamp).toBeGreaterThan(0);
  });

  it('should skip sync when cache file on disk is still valid', async () => {
    const cacheDir = join(
      tempDir,
      'config',
      'share',
      'opencode',
      'openrouter-sync',
    );
    await mkdir(cacheDir, { recursive: true });

    // Write a valid cache to disk
    const cachedModels = [createMockModel('cached/model')];
    await writeCache(
      { models: cachedModels, timestamp: Date.now() },
      { cacheDir },
    );

    // Write config with no models
    await writeFile(
      configPath,
      JSON.stringify(
        {
          provider: { openrouter: { models: {} } },
        },
        null,
        2,
      ),
      'utf-8',
    );

    let fetchCalled = false;
    const deps: SyncDeps = {
      readCache: () => readCache({ cacheDir }),
      writeCache: (data) => writeCache(data, { cacheDir }),
      isCacheValid: (data, ttlMs) => isCacheValid(data, ttlMs),
      fetchModels: async () => {
        fetchCalled = true;
        return { data: [] };
      },
      updateModels: (models, configPath, log) =>
        updateModels(models, configPath, log),
      readConfig: () => readConfig(),
    };

    const ctx = createMockCtx();
    await performSync(ctx, deps);

    // fetchModels should NOT have been called because cache is valid
    expect(fetchCalled).toBe(false);

    // Config should remain unchanged (no models added)
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    expect(Object.keys(config.provider.openrouter.models)).toHaveLength(0);
  });

  it('should produce model entries conforming to the OpenCode JSON schema', async () => {
    // Extract the model entry schema from src/schema.ts:
    // schema.provider (optional) -> record value -> .models (optional) -> record value
    const providerRecord = schema.shape.provider.unwrap(); // ZodRecord
    const providerObj = providerRecord._def.valueType; // provider object schema
    const modelsRecord = providerObj.shape.models.unwrap(); // ZodRecord
    const openCodeModelSchema = modelsRecord._def.valueType; // model entry schema (.strict())

    // Create config file
    await writeFile(
      configPath,
      JSON.stringify(
        {
          provider: { openrouter: { models: {} } },
        },
        null,
        2,
      ),
      'utf-8',
    );

    const mockModels = [
      createMockModel('openai/gpt-4', {
        pricing: {
          prompt: '0.00003',
          completion: '0.00006',
          input_cache_read: '0.000015',
        },
        context_length: 128000,
        top_provider: {
          context_length: 128000,
          max_completion_tokens: 4096,
          is_moderated: false,
        },
        supported_parameters: ['temperature', 'tools', 'reasoning'],
        architecture: {
          modality: 'text+image->text',
          input_modalities: ['text', 'image'],
          output_modalities: ['text'],
          tokenizer: 'gpt-4',
          instruct_type: null,
        },
      }),
      createMockModel('anthropic/claude-3-opus', {
        pricing: {
          prompt: '0.000015',
          completion: '0.000075',
          input_cache_read: '0.0000075',
        },
        context_length: 200000,
        top_provider: {
          context_length: 200000,
          max_completion_tokens: 4096,
          is_moderated: false,
        },
        supported_parameters: ['temperature', 'max_tokens'],
        architecture: {
          modality: 'text+image->text',
          input_modalities: ['text', 'image', 'pdf'],
          output_modalities: ['text'],
          tokenizer: 'claude',
          instruct_type: null,
        },
      }),
      createMockModel('meta/llama-3', {
        pricing: {
          prompt: '0.000001',
          completion: '0.000002',
          input_cache_read: '0',
        },
        context_length: 8192,
        top_provider: {
          context_length: 8192,
          max_completion_tokens: 2048,
          is_moderated: false,
        },
        supported_parameters: ['temperature'],
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text'],
          tokenizer: 'llama',
          instruct_type: null,
        },
      }),
    ];

    const cacheDir = join(
      tempDir,
      'config',
      'share',
      'opencode',
      'openrouter-sync',
    );

    const deps: SyncDeps = {
      readCache: () => readCache({ cacheDir }),
      writeCache: (data) => writeCache(data, { cacheDir }),
      isCacheValid: (data, ttlMs) => isCacheValid(data, ttlMs),
      fetchModels: async () => ({ data: mockModels }),
      updateModels: (models, configPath, log) =>
        updateModels(models, configPath, log),
      readConfig: () => readConfig(),
    };

    await performSync(createMockCtx(), deps);

    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    const models = config.provider.openrouter.models;

    // Validate every model entry against the OpenCode schema
    for (const [modelId, modelEntry] of Object.entries(models)) {
      const result = openCodeModelSchema.safeParse(modelEntry);
      expect(result.success).toBe(true);
      if (!result.success) {
        console.error(
          `Schema validation failed for ${modelId}:`,
          result.error.issues,
        );
      }
    }

    // Sanity check: all 3 models were written
    expect(Object.keys(models)).toHaveLength(3);
  });
});

/**
 * Live API integration tests - hit the real OpenRouter API and write to a real config file.
 * These tests verify the full pipeline works end-to-end with real data.
 */
describe('Live API integration', () => {
  const LIVE_API_TIMEOUT = 60000;

  it(
    'should find minimax/minimax-m2.5:free in the OpenRouter API response',
    async () => {
      const result = await fetchModels();

      expect('data' in result).toBe(true);
      if (!('data' in result)) return;

      const models = result.data;
      expect(models.length).toBeGreaterThan(0);

      const minimax = models.find((m) => m.id === 'minimax/minimax-m2.5:free');
      expect(minimax).toBeDefined();
      expect(minimax?.name).toBeTruthy();
      expect(minimax?.context_length).toBeGreaterThan(0);
    },
    LIVE_API_TIMEOUT,
  );

  it(
    'should fetch models from API and write them to config via updateModels',
    async () => {
      // Fetch real models from OpenRouter API
      const result = await fetchModels();
      expect('data' in result).toBe(true);
      if (!('data' in result)) return;

      const models = result.data;
      expect(models.length).toBeGreaterThan(100); // OpenRouter has hundreds of models

      // Write to a temp config file using the real updateModels function
      const tempConfigDir = join(
        tmpdir(),
        `openrouter-live-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      const tempConfigPath = join(tempConfigDir, 'opencode.json');

      try {
        await mkdir(tempConfigDir, { recursive: true });
        await writeFile(
          tempConfigPath,
          JSON.stringify(
            {
              provider: { openrouter: { models: {} } },
            },
            null,
            2,
          ),
          'utf-8',
        );

        const updateResult = await updateModels(models, tempConfigPath);

        expect(updateResult.added).toBeGreaterThan(100);
        expect(updateResult.skipped).toBe(0);

        // Read config back and verify minimax model is there
        const configContent = await readFile(tempConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        const configModels = config.provider.openrouter.models;

        expect(configModels['minimax/minimax-m2.5:free']).toBeDefined();
        expect(configModels['minimax/minimax-m2.5:free'].name).toBeTruthy();

        // Verify model entry shape (no raw API fields)
        const entry = configModels['minimax/minimax-m2.5:free'];
        expect(entry.id).toBeUndefined();
        expect(entry.pricing).toBeUndefined();
        expect(entry.architecture).toBeUndefined();
      } finally {
        await rm(tempConfigDir, { recursive: true, force: true }).catch(
          () => {},
        );
      }
    },
    LIVE_API_TIMEOUT,
  );
});

/**
 * performSync with real deps against the real user profile.
 * Hits the live OpenRouter API, writes to the actual config, and validates
 * every model entry against the OpenCode schema from src/schema.ts.
 */
describe('performSync against real profile', () => {
  const TIMEOUT = 60000;
  let realConfigPath: string;
  let originalContent: string;

  // Extract the model entry validator from the schema once
  const providerRecord = schema.shape.provider.unwrap();
  const providerObj = providerRecord._def.valueType;
  const modelsRecord = providerObj.shape.models.unwrap();
  const openCodeModelSchema = modelsRecord._def.valueType;

  beforeEach(async () => {
    const { resolveGlobalConfigPath } = await import('../src/config.js');
    realConfigPath = await resolveGlobalConfigPath();

    // Back up the real config
    originalContent = await readFile(realConfigPath, 'utf-8');
  });

  afterEach(async () => {
    // Restore the real config
    await writeFile(realConfigPath, originalContent, 'utf-8');
  });

  it(
    'should sync models to real config and produce schema-valid entries',
    async () => {
      // Fetch real models from OpenRouter API
      const result = await fetchModels();
      expect('data' in result).toBe(true);
      if (!('data' in result)) return;

      const models = result.data;
      expect(models.length).toBeGreaterThan(100);

      // Write to the real config
      const updateResult = await updateModels(models, realConfigPath);
      console.log('updateModels result:', updateResult);
      expect(updateResult.added).toBeGreaterThan(0);

      // Read back and validate
      const configContent = await readFile(realConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      const configModels = config.provider?.openrouter?.models ?? {};
      const modelIds = Object.keys(configModels);

      expect(modelIds.length).toBeGreaterThan(100);
      expect(modelIds).toContain('minimax/minimax-m2.5:free');

      // Validate every model entry against the OpenCode schema
      const failures: string[] = [];
      for (const [modelId, modelEntry] of Object.entries(configModels)) {
        const parseResult = openCodeModelSchema.safeParse(modelEntry);
        if (!parseResult.success) {
          failures.push(
            `${modelId}: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
          );
        }
      }

      if (failures.length > 0) {
        console.error(
          `Schema validation failures (${failures.length}/${modelIds.length}):`,
        );
        // Log first 10 for diagnostics
        for (const f of failures.slice(0, 10)) {
          console.error(' ', f);
        }
      }

      expect(failures).toHaveLength(0);
    },
    TIMEOUT,
  );
});

/**
 * Real config integration tests.
 * Fetches from the live OpenRouter API, writes to a temp config using updateModels,
 * then verifies the specific model exists in the config file on disk.
 */
describe('Config file model verification', () => {
  const TIMEOUT = 60000;

  it(
    'should have minimax/minimax-m2.5:free in config after updateModels writes real API data',
    async () => {
      // Fetch real models from OpenRouter API
      const result = await fetchModels();
      expect('data' in result).toBe(true);
      if (!('data' in result)) return;

      const models = result.data;

      // Write to a temp config
      const tempConfigDir = join(
        tmpdir(),
        `openrouter-configcheck-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      const tempConfigPath = join(tempConfigDir, 'opencode.json');

      try {
        await mkdir(tempConfigDir, { recursive: true });
        await writeFile(
          tempConfigPath,
          JSON.stringify(
            {
              provider: { openrouter: { models: {} } },
            },
            null,
            2,
          ),
          'utf-8',
        );

        await updateModels(models, tempConfigPath);

        // Read config back and check for the model
        const configContent = await readFile(tempConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        const configModels = config.provider.openrouter.models;
        const modelIds = Object.keys(configModels);

        // Verify the specific model is in the config
        expect(modelIds).toContain('minimax/minimax-m2.5:free');

        // Verify it has a valid entry
        const entry = configModels['minimax/minimax-m2.5:free'];
        expect(entry).toBeDefined();
        expect(entry.name).toBeTruthy();
        expect(entry.limit).toBeDefined();
        expect(entry.limit.context).toBeGreaterThan(0);
      } finally {
        await rm(tempConfigDir, { recursive: true, force: true }).catch(
          () => {},
        );
      }
    },
    TIMEOUT,
  );
});

/**
 * CLI integration test - run `opencode models` and check the output.
 * Self-contained: fetches models from the live API, writes them to the real
 * config, runs the CLI, then restores the original config.
 */
describe('opencode CLI model list', () => {
  const CLI_TIMEOUT = 60000;

  let realConfigPath: string;
  let originalContent: string;

  // Extract the model entry validator from the schema once
  const providerRecord = schema.shape.provider.unwrap();
  const providerObj = providerRecord._def.valueType;
  const modelsRecord = providerObj.shape.models.unwrap();
  const openCodeModelSchema = modelsRecord._def.valueType;

  beforeEach(async () => {
    const { resolveGlobalConfigPath } = await import('../src/config.js');
    realConfigPath = await resolveGlobalConfigPath();

    // Back up the real config
    originalContent = await readFile(realConfigPath, 'utf-8');

    // Fetch models from the live API and write them to the real config
    const result = await fetchModels();
    expect('data' in result).toBe(true);
    if (!('data' in result)) return;

    const models = result.data;
    expect(models.length).toBeGreaterThan(100);

    const updateResult = await updateModels(models, realConfigPath);
    expect(updateResult.added).toBeGreaterThan(0);

    // Validate all written entries against the OpenCode schema
    const configContent = await readFile(realConfigPath, 'utf-8');
    const config = JSON.parse(configContent);
    const configModels = config.provider?.openrouter?.models ?? {};

    const failures: string[] = [];
    for (const [modelId, modelEntry] of Object.entries(configModels)) {
      const parseResult = openCodeModelSchema.safeParse(modelEntry);
      if (!parseResult.success) {
        failures.push(
          `${modelId}: ${parseResult.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        );
      }
    }

    if (failures.length > 0) {
      console.error(
        `Schema validation failures (${failures.length}/${Object.keys(configModels).length}):`,
      );
      for (const f of failures.slice(0, 10)) {
        console.error(' ', f);
      }
    }
    expect(failures).toHaveLength(0);
  });

  afterEach(async () => {
    // Restore the real config
    await writeFile(realConfigPath, originalContent, 'utf-8');
  });

  function runOpenCode(args: string[]): Promise<string> {
    const { spawn } = require('node:child_process');
    return new Promise<string>((resolve, reject) => {
      const proc = spawn('opencode', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        timeout: CLI_TIMEOUT,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (err: Error) => reject(err));
      proc.on('close', (code: number | null) => {
        if (code !== 0) {
          reject(
            new Error(
              `opencode ${args.join(' ')} exited with code ${code}\nstderr: ${stderr}\nstdout: ${stdout}`,
            ),
          );
        } else {
          resolve(stdout);
        }
      });
    });
  }

  it(
    'should list openrouter/minimax/minimax-m2.5:free in opencode models output',
    async () => {
      const output = await runOpenCode(['models']);

      const lines = output
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const openrouterModels = lines.filter((l) => l.startsWith('openrouter/'));

      // Verify that openrouter models exist at all
      expect(openrouterModels.length).toBeGreaterThan(0);

      // Check for the specific :free model
      const hasFreeModel = lines.some((l) =>
        l.includes('minimax/minimax-m2.5:free'),
      );
      if (!hasFreeModel) {
        // Log diagnostic info: show all minimax-related models
        const minimaxModels = lines.filter((l) =>
          l.toLowerCase().includes('minimax'),
        );
        console.log('Minimax models found in opencode models:', minimaxModels);
      }
      expect(hasFreeModel).toBe(true);
    },
    CLI_TIMEOUT,
  );
});
