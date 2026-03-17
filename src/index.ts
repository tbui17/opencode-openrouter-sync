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

import OpenRouterModelSyncPlugin from "./plugin.js";

export type {
	AppendPromptOptions,
	ToastOptions,
	ToastVariant,
	TuiClient,
} from "./tui.js";

export type {
	CacheData,
	ConfigModelEntry,
	DefaultParameters,
	ModelArchitecture,
	ModelFilter,
	ModelPricing,
	OpenCodeModelEntry,
	OpenRouterModel,
	OpenRouterResponse,
	PluginContext,
	PluginOptions,
	SyncConfig,
	SyncResult,
	TopProvider,
} from "./types.js";

export default OpenRouterModelSyncPlugin;
