/**
 * File-based caching system for OpenRouter model data
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
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
  return path.join(
    os.homedir(),
    '.local',
    'share',
    'opencode',
    'openrouter-sync',
  );
}

const defaultConfig: SyncConfig = {
  cacheDir: getDefaultCacheDir(),
  cacheFile: 'cache.json',
  cacheTtlMs: DEFAULT_CACHE_TTL_MS,
  apiEndpoint: 'https://openrouter.ai/api/v1/models',
  apiTimeout: 30000,
  globalConfigPath: path.join(
    os.homedir(),
    '.config',
    'opencode',
    'opencode.json',
  ),
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
async function ensureCacheDir(
  config?: Partial<SyncConfig>,
  log?: (msg: string) => void,
): Promise<void> {
  const cfg = { ...defaultConfig, ...config };
  log?.(`Ensuring cache directory exists: ${cfg.cacheDir}`);
  await fs.mkdir(cfg.cacheDir, { recursive: true });
}

/**
 * Check if the cache is valid (exists and not expired)
 * @param cacheData - The cached data to validate
 * @param ttlMs - Time-to-live in milliseconds (default: 24 hours)
 * @param log - Optional logging function
 * @returns true if cache is valid, false otherwise
 */
export function isCacheValid(
  cacheData: CacheData | null,
  ttlMs = DEFAULT_CACHE_TTL_MS,
  log?: (msg: string) => void,
): boolean {
  if (!cacheData) {
    log?.('Cache data is null, cache invalid');
    return false;
  }

  if (!cacheData.timestamp || typeof cacheData.timestamp !== 'number') {
    log?.('Cache has invalid or missing timestamp');
    return false;
  }

  const now = Date.now();
  const age = now - cacheData.timestamp;
  const valid = age >= 0 && age < ttlMs;

  if (valid) {
    const remainingMs = ttlMs - age;
    log?.(
      `Cache is valid (age: ${Math.round(age / 1000)}s, expires in: ${Math.round(remainingMs / 1000)}s, models: ${cacheData.models?.length ?? 0})`,
    );
  } else {
    log?.(
      `Cache is expired (age: ${Math.round(age / 1000)}s, ttl: ${Math.round(ttlMs / 1000)}s)`,
    );
  }

  return valid;
}

/**
 * Read the cache from disk
 * @param config - Optional sync configuration override
 * @param log - Optional logging function
 * @returns The cached data or null if cache doesn't exist or is invalid
 */
export async function readCache(
  config?: Partial<SyncConfig>,
  log?: (msg: string) => void,
): Promise<CacheData | null> {
  const cachePath = getCachePath(config);
  log?.(`Reading cache from ${cachePath}`);

  try {
    const data = await fs.readFile(cachePath, 'utf-8');
    const cacheData: CacheData = JSON.parse(data);

    // Validate cache structure
    if (!cacheData.models || !Array.isArray(cacheData.models)) {
      log?.(
        'Cache file has invalid structure: missing or non-array models field',
      );
      return null;
    }

    if (typeof cacheData.timestamp !== 'number') {
      log?.(
        'Cache file has invalid structure: missing or non-number timestamp',
      );
      return null;
    }

    log?.(
      `Cache loaded: ${cacheData.models.length} models, timestamp ${new Date(cacheData.timestamp).toISOString()}`,
    );
    return cacheData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log?.(`Cache file not found at ${cachePath}`);
    } else {
      log?.(
        `Error reading cache file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  }
}

/**
 * Write data to the cache file
 * @param cacheData - The data to cache
 * @param config - Optional sync configuration override
 * @param log - Optional logging function
 */
export async function writeCache(
  cacheData: CacheData,
  config?: Partial<SyncConfig>,
  log?: (msg: string) => void,
): Promise<void> {
  const cachePath = getCachePath(config);
  log?.(`Writing cache to ${cachePath} (${cacheData.models.length} models)`);

  // Ensure the directory exists
  await ensureCacheDir(config, log);

  // Write atomically: first to temp file, then rename
  const tempPath = `${cachePath}.tmp`;
  const data = JSON.stringify(cacheData, null, 2);

  await fs.writeFile(tempPath, data, 'utf-8');
  await fs.rename(tempPath, cachePath);
  log?.(`Cache written successfully (${data.length} bytes)`);
}

/**
 * Clear the cache by deleting the cache file
 * @param config - Optional sync configuration override
 * @param log - Optional logging function
 * @returns true if cache was cleared, false if no cache existed
 */
export async function clearCache(
  config?: Partial<SyncConfig>,
  log?: (msg: string) => void,
): Promise<boolean> {
  const cachePath = getCachePath(config);
  log?.(`Clearing cache at ${cachePath}`);

  try {
    await fs.unlink(cachePath);
    log?.('Cache cleared successfully');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log?.('No cache file to clear');
    } else {
      log?.(
        `Error clearing cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return false;
  }
}
