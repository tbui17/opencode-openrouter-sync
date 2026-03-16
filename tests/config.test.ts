/**
 * Tests for config utilities
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { readConfig, writeConfig, updateModels, getGlobalConfigPath } from '../src/config';
import type { OpenRouterModel } from '../src/types';
import { join } from 'path';
import { tmpdir } from 'os';

let testDir: string;

const testConfigPath = () => join(testDir, 'opencode.json');

beforeAll(async () => {
  const fs = await import('fs/promises');
  testDir = await fs.mkdtemp(join(tmpdir(), 'config-test-'));
});

describe('readConfig', () => {
  test('returns default config when file does not exist', async () => {
    const fs = await import('fs/promises');
    const nonExistentPath = testDir + '/nonexistent.json';
    
    const config = await readConfig(nonExistentPath);
    expect(config).toEqual({
      provider: {
        openrouter: {
          models: {}
        }
      }
    });
  });

  test('returns parsed config for valid JSON', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    const testConfig = {
      provider: {
        openrouter: {
          models: {
            'test-model': {
              id: 'test-model',
              name: 'Test Model',
              provider: 'openrouter'
            }
          }
        }
      },
      customField: 'test'
    };
    
    await fs.writeFile(configPath, JSON.stringify(testConfig), 'utf-8');
    
    const config = await readConfig(configPath);
    expect(config).toEqual(testConfig);
    expect(config?.provider?.openrouter?.models).toBeDefined();
  });

  test('returns null for malformed JSON', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    await fs.writeFile(configPath, '{ invalid json }', 'utf-8');
    
    const config = await readConfig(configPath);
    expect(config).toBeNull();
  });

  test('ensures provider.openrouter.models exists in returned config', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    await fs.writeFile(configPath, JSON.stringify({}), 'utf-8');
    
    const config = await readConfig(configPath);
    expect(config?.provider).toBeDefined();
    expect(config?.provider?.openrouter).toBeDefined();
    expect(config?.provider?.openrouter?.models).toBeDefined();
  });
});

describe('writeConfig', () => {
  test('writes config to file successfully', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    const config = {
      provider: {
        openrouter: {
          models: {}
        }
      }
    };
    
    const result = await writeConfig(config, configPath);
    expect(result).toBe(true);
    
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.provider.openrouter.models).toEqual({});
  });

  test('preserves existing structure (no overwrites)', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    const existingConfig = {
      provider: {
        openrouter: {
          models: {
            'existing-model': {
              id: 'existing-model',
              name: 'Existing Model',
              provider: 'openrouter',
              context_length: 128000
            }
          }
        }
      },
      customField: 'preserved'
    };
    
    await fs.writeFile(configPath, JSON.stringify(existingConfig), 'utf-8');
    
    const newConfig = {
      provider: {
        openrouter: {
          models: {
            'new-model': {
              id: 'new-model',
              name: 'New Model',
              provider: 'openrouter'
            }
          }
        }
      }
    };
    
    await writeConfig(newConfig, configPath);
    
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(parsed.provider.openrouter.models['existing-model']).toEqual({
      id: 'existing-model',
      name: 'Existing Model',
      provider: 'openrouter',
      context_length: 128000
    });
    
    expect(parsed.provider.openrouter.models['new-model']).toEqual({
      id: 'new-model',
      name: 'New Model',
      provider: 'openrouter'
    });
    
    expect(parsed.customField).toBe('preserved');
  });
});

describe('updateModels', () => {
  test('adds new models only', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    await fs.writeFile(configPath, JSON.stringify({
      provider: { openrouter: { models: {} } }
    }), 'utf-8');
    
    const mockModels: OpenRouterModel[] = [
      {
        id: 'model-1',
        canonical_slug: 'model-1',
        hugging_face_id: 'hf/model1',
        name: 'Model 1',
        created: 1234567890,
        description: 'Test model 1',
        context_length: 128000,
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0.001', completion: '0.002' },
        top_provider: { is_mixed: false },
        per_request_limits: null,
        supported_parameters: [],
        default_parameters: {},
        expiration_date: null
      },
      {
        id: 'model-2',
        canonical_slug: 'model-2',
        hugging_face_id: 'hf/model2',
        name: 'Model 2',
        created: 1234567890,
        description: 'Test model 2',
        context_length: 64000,
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0.002', completion: '0.004' },
        top_provider: { is_mixed: false },
        per_request_limits: null,
        supported_parameters: [],
        default_parameters: {},
        expiration_date: null
      }
    ];
    
    const result = await updateModels(mockModels, configPath);
    
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
    
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(parsed.provider.openrouter.models['model-1']).toBeDefined();
    expect(parsed.provider.openrouter.models['model-2']).toBeDefined();
  });

  test('does not overwrite existing models', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    const existingConfig = {
      provider: {
        openrouter: {
          models: {
            'existing-model': {
              id: 'existing-model',
              name: 'Existing Model',
              provider: 'openrouter',
              context_length: 999999
            }
          }
        }
      }
    };
    
    await fs.writeFile(configPath, JSON.stringify(existingConfig), 'utf-8');
    
    const mockModels: OpenRouterModel[] = [
      {
        id: 'existing-model',
        canonical_slug: 'existing-model',
        hugging_face_id: 'hf/existing',
        name: 'Updated Name (should not appear)',
        created: 1234567890,
        description: 'Updated description',
        context_length: 128000,
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0.001', completion: '0.002' },
        top_provider: { is_mixed: false },
        per_request_limits: null,
        supported_parameters: [],
        default_parameters: {},
        expiration_date: null
      },
      {
        id: 'new-model',
        canonical_slug: 'new-model',
        hugging_face_id: 'hf/new',
        name: 'New Model',
        created: 1234567890,
        description: 'New model',
        context_length: 64000,
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0.002', completion: '0.004' },
        top_provider: { is_mixed: false },
        per_request_limits: null,
        supported_parameters: [],
        default_parameters: {},
        expiration_date: null
      }
    ];
    
    const result = await updateModels(mockModels, configPath);
    
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(parsed.provider.openrouter.models['existing-model'].context_length).toBe(999999);
    expect(parsed.provider.openrouter.models['existing-model'].name).toBe('Existing Model');
    
    expect(parsed.provider.openrouter.models['new-model']).toBeDefined();
  });

  test('skips models without ID', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    await fs.writeFile(configPath, JSON.stringify({
      provider: { openrouter: { models: {} } }
    }), 'utf-8');
    
    const mockModels: OpenRouterModel[] = [
      {
        id: '',
        canonical_slug: '',
        hugging_face_id: '',
        name: 'Model Without ID',
        created: 1234567890,
        description: '',
        context_length: 0,
        architecture: { input_modalities: [], output_modalities: [] },
        pricing: { prompt: '0', completion: '0' },
        top_provider: { is_mixed: false },
        per_request_limits: null,
        supported_parameters: [],
        default_parameters: {},
        expiration_date: null
      }
    ];
    
    const result = await updateModels(mockModels, configPath);
    
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test('handles missing config gracefully', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    try {
      await fs.unlink(configPath);
    } catch {
      // File may not exist
    }
    
    const mockModels: OpenRouterModel[] = [
      {
        id: 'test-model',
        canonical_slug: 'test',
        hugging_face_id: 'hf/test',
        name: 'Test',
        created: 123,
        description: 'test',
        context_length: 1000,
        architecture: { input_modalities: [], output_modalities: [] },
        pricing: { prompt: '0', completion: '0' },
        top_provider: { is_mixed: false },
        per_request_limits: null,
        supported_parameters: [],
        default_parameters: {},
        expiration_date: null
      }
    ];
    
    const result = await updateModels(mockModels, configPath);
    expect(result.added).toBe(1);
  });
});

describe('deepMerge logic (via writeConfig)', () => {
  test('merges nested objects without overwriting', async () => {
    const fs = await import('fs/promises');
    const configPath = testConfigPath();
    
    const existing = {
      level1: {
        level2: {
          existingValue: 'preserved',
          anotherValue: 'also preserved'
        }
      },
      topLevel: 'keep this'
    };
    
    await fs.writeFile(configPath, JSON.stringify(existing), 'utf-8');
    
    const newConfig = {
      level1: {
        level2: {
          newValue: 'added'
        }
      },
      newTopLevel: 'brand new'
    };
    
    await writeConfig(newConfig, configPath);
    
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(parsed.level1.level2.existingValue).toBe('preserved');
    expect(parsed.level1.level2.anotherValue).toBe('also preserved');
    expect(parsed.level1.level2.newValue).toBe('added');
    expect(parsed.topLevel).toBe('keep this');
    expect(parsed.newTopLevel).toBe('brand new');
  });
});
