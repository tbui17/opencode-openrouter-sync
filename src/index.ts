/**
 * OpenRouter Model Sync Plugin - Main Export
 *
 * This is the main entry point for the plugin. It exports:
 * - The plugin function (default)
 * - Utility functions for manual sync and cache management
 * - Type definitions for TypeScript consumers
 */

import OpenRouterModelSyncPlugin from './plugin.js';
import { clearCache, readCache, writeCache, isCacheValid, getCachePath } from './cache.js';
import { fetchModels } from './api.js';
import { updateModels, readConfig, writeConfig, getGlobalConfigPath } from './config.js';

export type {
  OpenRouterModel,
  OpenRouterResponse,
  CacheData,
  SyncConfig,
  PluginOptions,
  PluginContext,
  SyncResult,
  ModelFilter,
  ConfigModelEntry,
  ModelArchitecture,
  ModelPricing,
  TopProvider,
  DefaultParameters,
} from './types.js';

/**
 * Perform a full sync of models from OpenRouter API to the config
 * This combines fetching models and updating the config
 * @returns Sync result with counts
 */
export async function syncModels(): Promise<{ added: number; skipped: number }> {
  const models = await fetchModels();

  if (!models) {
    return { added: 0, skipped: 0 };
  }

  return updateModels(models);
}

/**
 * Clear the model cache
 * Forces a fresh sync on next plugin run
 * @returns true if cache was cleared
 */
export { clearCache };

export { readCache, writeCache, isCacheValid, getCachePath };

export { fetchModels, updateModels, readConfig, writeConfig, getGlobalConfigPath };

export default OpenRouterModelSyncPlugin;
