/**
 * OpenRouter Model Sync Plugin - Main Export
 *
 * This is the main entry point for the plugin.
 *
 * IMPORTANT: Only default export and type exports are allowed here.
 * OpenCode treats ALL exports as plugin instances and calls them.
 * Utility functions are available via the `/sync` subpath:
 *   import { syncModels } from 'opencode-openrouter-sync/sync'
 */

import OpenRouterModelSyncPlugin from './plugin.js';

// Type-only exports are safe - OpenCode doesn't try to call types
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

// Default export is the plugin function
export default OpenRouterModelSyncPlugin;
