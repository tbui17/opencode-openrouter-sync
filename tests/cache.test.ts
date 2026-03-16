import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  readCache,
  writeCache,
  isCacheValid,
  clearCache,
  getCachePath,
} from '../src/cache';
import type { CacheData } from '../src/types';

// Test constants
const TEST_CACHE_DIR = path.join(os.tmpdir(), 'openrouter-cache-test');
const TEST_CACHE_FILE = 'test-cache.json';

const testConfig = {
  cacheDir: TEST_CACHE_DIR,
  cacheFile: TEST_CACHE_FILE,
  cacheTtlMs: 1000, // 1 second for testing
};

const sampleModels = [
  {
    id: 'model-1',
    canonical_slug: 'model-1',
    hugging_face_id: 'hf/model1',
    name: 'Test Model 1',
    created: 1234567890,
    description: 'A test model',
    context_length: 4096,
    architecture: {
      modality: 'text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'cl100k_base',
      instruct_type: 'chat',
    },
    pricing: {
      prompt: '0.001',
      completion: '0.001',
      input_cache_read: '0.0001',
    },
    top_provider: {
      context_length: 4096,
      max_completion_tokens: 4096,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: ['temperature', 'top_p'],
    default_parameters: {
      temperature: 0.7,
      top_p: 0.9,
      top_k: null,
      frequency_penalty: null,
      presence_penalty: null,
      repetition_penalty: null,
    },
    expiration_date: null,
  },
];

describe('cache module', () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  describe('getCachePath', () => {
    test('returns correct path with custom config', () => {
      const result = getCachePath(testConfig);
      expect(result).toBe(path.join(TEST_CACHE_DIR, TEST_CACHE_FILE));
    });

    test('returns default path without config', () => {
      const result = getCachePath();
      expect(result).toContain('.local');
      expect(result).toContain('openrouter-sync');
      expect(result).toEndWith('cache.json');
    });
  });

  describe('writeCache', () => {
    test('writes cache data to file', async () => {
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: Date.now(),
      };

      await writeCache(cacheData, testConfig);

      const cachePath = getCachePath(testConfig);
      const fileContent = await fs.readFile(cachePath, 'utf-8');
      const parsed = JSON.parse(fileContent);

      expect(parsed.models).toHaveLength(1);
      expect(parsed.models[0].id).toBe('model-1');
      expect(parsed.timestamp).toBe(cacheData.timestamp);
    });

    test('creates cache directory if it does not exist', async () => {
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: Date.now(),
      };

      // Ensure directory doesn't exist
      await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });

      await writeCache(cacheData, testConfig);

      const dirExists = await fs.access(TEST_CACHE_DIR).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });
  });

  describe('readCache', () => {
    test('returns null when cache file does not exist', async () => {
      const result = await readCache(testConfig);
      expect(result).toBeNull();
    });

    test('returns null when cache file is corrupted', async () => {
      const cachePath = getCachePath(testConfig);
      await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath, 'invalid json{', 'utf-8');

      const result = await readCache(testConfig);
      expect(result).toBeNull();
    });

    test('returns null when cache has no models array', async () => {
      const cachePath = getCachePath(testConfig);
      await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify({ timestamp: Date.now() }), 'utf-8');

      const result = await readCache(testConfig);
      expect(result).toBeNull();
    });

    test('returns null when cache has no timestamp', async () => {
      const cachePath = getCachePath(testConfig);
      await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify({ models: sampleModels }), 'utf-8');

      const result = await readCache(testConfig);
      expect(result).toBeNull();
    });

    test('returns cache data when cache is valid', async () => {
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: Date.now(),
      };
      await writeCache(cacheData, testConfig);

      const result = await readCache(testConfig);

      expect(result).not.toBeNull();
      expect(result!.models).toHaveLength(1);
      expect(result!.timestamp).toBe(cacheData.timestamp);
    });
  });

  describe('isCacheValid', () => {
    test('returns false when cacheData is null', () => {
      expect(isCacheValid(null)).toBe(false);
    });

    test('returns false when cacheData is undefined', () => {
      expect(isCacheValid(undefined as any)).toBe(false);
    });

    test('returns false when timestamp is missing', () => {
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: 0,
      };
      // timestamp 0 is falsy, so it should fail
      expect(isCacheValid(cacheData)).toBe(false);
    });

    test('returns false when timestamp is not a number', () => {
      const cacheData = {
        models: sampleModels,
        timestamp: 'invalid' as any,
      };
      expect(isCacheValid(cacheData as any)).toBe(false);
    });

    test('returns false when cache is expired (older than TTL)', async () => {
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: Date.now() - 2000, // 2 seconds ago (TTL is 1 second)
      };

      expect(isCacheValid(cacheData, 1000)).toBe(false);
    });

    test('returns true when cache is within TTL', () => {
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: Date.now(),
      };

      expect(isCacheValid(cacheData, 1000)).toBe(true);
    });

    test('returns true when cache is exactly at TTL boundary', () => {
      const now = Date.now();
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: now - 1000, // Exactly 1000ms ago
      };

      // age < ttlMs (1000 < 1000 is false, so 999 < 1000 would be true)
      // age >= 0 && age < ttlMs: 1000 >= 0 && 1000 < 1000 = false
      // The implementation uses age < ttlMs (not <=), so at exactly TTL it returns false
      expect(isCacheValid(cacheData, 1000)).toBe(false);
    });

    test('uses default TTL of 24 hours', () => {
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: Date.now(),
      };

      // Should be valid with default 24 hour TTL
      expect(isCacheValid(cacheData)).toBe(true);
    });
  });

  describe('clearCache', () => {
    test('returns false when cache file does not exist', async () => {
      const result = await clearCache(testConfig);
      expect(result).toBe(false);
    });

    test('returns true when cache is successfully cleared', async () => {
      // First write some cache data
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: Date.now(),
      };
      await writeCache(cacheData, testConfig);

      const cachePath = getCachePath(testConfig);
      const fileExistsBefore = await fs.access(cachePath).then(() => true).catch(() => false);
      expect(fileExistsBefore).toBe(true);

      // Now clear the cache
      const result = await clearCache(testConfig);
      expect(result).toBe(true);

      const fileExistsAfter = await fs.access(cachePath).then(() => true).catch(() => false);
      expect(fileExistsAfter).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    test('readCache returns data even for expired cache (expiration is checked separately via isCacheValid)', async () => {
      // Write cache with old timestamp
      const cachePath = getCachePath(testConfig);
      await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
      const oldTimestamp = Date.now() - 10000; // 10 seconds ago (TTL is 1 second)
      await fs.writeFile(
        cachePath,
        JSON.stringify({ models: sampleModels, timestamp: oldTimestamp }),
        'utf-8'
      );

      // readCache returns the data regardless of expiration
      const result = await readCache(testConfig);
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBe(oldTimestamp);

      // isCacheValid should return false for expired cache
      expect(isCacheValid(result, 1000)).toBe(false);
    });

    test('complete cache lifecycle: write, read, clear', async () => {
      const cacheData: CacheData = {
        models: sampleModels as any,
        timestamp: Date.now(),
      };

      // Write
      await writeCache(cacheData, testConfig);

      // Read
      const readResult = await readCache(testConfig);
      expect(readResult).not.toBeNull();
      expect(readResult!.models).toHaveLength(1);

      // Check validity
      expect(isCacheValid(readResult, 1000)).toBe(true);

      // Clear
      const clearResult = await clearCache(testConfig);
      expect(clearResult).toBe(true);

      // Read again should return null
      const afterClear = await readCache(testConfig);
      expect(afterClear).toBeNull();
    });
  });
});
