/**
 * File-based caching system for OpenRouter model data
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { CacheData, SyncConfig } from './types';

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getDefaultCacheDir(): string {
  // If OPENCODE_CONFIG_DIR is set, derive cache dir from it
  // Otherwise use default ~/.local/share/opencode/openrouter-sync
  const configDir = process.env.OPENCODE_CONFIG_DIR;
  if (configDir) {
    // If config is in ~/.config/opencode, cache should be in ~/.local/share/opencode
    // If config is in custom dir, cache should be in {customParent}/share/opencode/openrouter-sync
    const parentDir = path.dirname(configDir);
    return path.join(parentDir, 'share', 'opencode', 'openrouter-sync');
  }
  return path.join(os.homedir(), '.local', 'share', 'opencode', 'openrouter-sync');
}

const defaultConfig: SyncConfig = {
  cacheDir: getDefaultCacheDir(),
  cacheFile: 'cache.json',
  cacheTtlMs: DEFAULT_CACHE_TTL_MS,
  apiEndpoint: 'https://openrouter.ai/api/v1/models',
  apiTimeout: 30000,
  globalConfigPath: path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
};

/**
 * Get the full path to the cache file
 * @param config - Optional sync configuration override
 * @returns The absolute path to the cache file
 */
export function getCachePath(config?: Partial<SyncConfig>): string {
  const cfg = { ...defaultConfig, ...config };
  return path.join(cfg.cacheDir, cfg.cacheFile);
}

/**
 * Ensure the cache directory exists
 * @param config - Optional sync configuration override
 */
async function ensureCacheDir(config?: Partial<SyncConfig>): Promise<void> {
  const cfg = { ...defaultConfig, ...config };
  await fs.mkdir(cfg.cacheDir, { recursive: true });
}

/**
 * Check if the cache is valid (exists and not expired)
 * @param cacheData - The cached data to validate
 * @param ttlMs - Time-to-live in milliseconds (default: 24 hours)
 * @returns true if cache is valid, false otherwise
 */
export function isCacheValid(cacheData: CacheData | null, ttlMs = DEFAULT_CACHE_TTL_MS): boolean {
  if (!cacheData) {
    return false;
  }

  if (!cacheData.timestamp || typeof cacheData.timestamp !== 'number') {
    return false;
  }

  const now = Date.now();
  const age = now - cacheData.timestamp;

  return age >= 0 && age < ttlMs;
}

/**
 * Read the cache from disk
 * @param config - Optional sync configuration override
 * @returns The cached data or null if cache doesn't exist or is invalid
 */
export async function readCache(config?: Partial<SyncConfig>): Promise<CacheData | null> {
  const cachePath = getCachePath(config);

  try {
    const data = await fs.readFile(cachePath, 'utf-8');
    const cacheData: CacheData = JSON.parse(data);

    // Validate cache structure
    if (!cacheData.models || !Array.isArray(cacheData.models)) {
      return null;
    }

    if (typeof cacheData.timestamp !== 'number') {
      return null;
    }

    return cacheData;
  } catch (error) {
    // File doesn't exist or is corrupt - return null
    return null;
  }
}

/**
 * Write data to the cache file
 * @param cacheData - The data to cache
 * @param config - Optional sync configuration override
 */
export async function writeCache(cacheData: CacheData, config?: Partial<SyncConfig>): Promise<void> {
  const cachePath = getCachePath(config);

  // Ensure the directory exists
  await ensureCacheDir(config);

  // Write atomically: first to temp file, then rename
  const tempPath = `${cachePath}.tmp`;
  const data = JSON.stringify(cacheData, null, 2);

  await fs.writeFile(tempPath, data, 'utf-8');
  await fs.rename(tempPath, cachePath);
}

/**
 * Clear the cache by deleting the cache file
 * @param config - Optional sync configuration override
 * @returns true if cache was cleared, false if no cache existed
 */
export async function clearCache(config?: Partial<SyncConfig>): Promise<boolean> {
  const cachePath = getCachePath(config);

  try {
    await fs.unlink(cachePath);
    return true;
  } catch (error) {
    // File doesn't exist
    return false;
  }
}
