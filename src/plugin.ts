/**
 * OpenRouter Model Sync Plugin - Entry Point
 *
 * This plugin automatically syncs available models from OpenRouter's public API
 * to the global OpenCode configuration. It runs once per 24 hours on startup.
 */

import { type FetchModelsOptions, fetchModels } from './api.js';
import { isCacheValid, readCache, writeCache } from './cache.js';
import { readConfig, updateModels } from './config.js';
import type {
  CacheData,
  FetchResult,
  OpenRouterModel,
  PluginContext,
} from './types.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SERVICE_NAME = 'openrouter-sync';

export interface SyncDeps {
  readCache: (log?: (msg: string) => void) => Promise<CacheData | null>;
  writeCache: (data: CacheData, log?: (msg: string) => void) => Promise<void>;
  isCacheValid: (
    data: CacheData | null,
    ttlMs: number,
    log?: (msg: string) => void,
  ) => boolean;
  fetchModels: (options?: FetchModelsOptions) => Promise<FetchResult>;
  updateModels: (
    models: OpenRouterModel[],
    configPath?: string,
    log?: (msg: string) => void,
  ) => Promise<{ added: number; skipped: number; removed: number }>;
  readConfig: (
    log?: (msg: string) => void,
  ) => Promise<Record<string, unknown> | null>;
}

const defaultDeps: SyncDeps = {
  readCache: (log) => readCache(undefined, log),
  writeCache: (data, log) => writeCache(data, undefined, log),
  isCacheValid: (data, ttlMs, log) => isCacheValid(data, ttlMs, log),
  fetchModels: (options) => fetchModels(options),
  updateModels: (models, configPath, log) =>
    updateModels(models, configPath, log),
  readConfig: (log) => readConfig(undefined, log),
};

function getApiUrlFromConfig(
  config: Record<string, unknown> | null,
): string | undefined {
  if (!config) return undefined;

  const provider = config.provider as Record<string, unknown> | undefined;
  if (!provider) return undefined;

  const openrouter = provider.openrouter as Record<string, unknown> | undefined;
  if (!openrouter) return undefined;

  const options = openrouter.options as Record<string, unknown> | undefined;
  if (!options) return undefined;

  const apiUrl = options.apiUrl;
  return typeof apiUrl === 'string' ? apiUrl : undefined;
}

export async function performSync(
  ctx: PluginContext,
  deps: SyncDeps = defaultDeps,
): Promise<void> {
  const { client } = ctx;

  const log = (msg: string) => {
    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: 'debug',
        message: msg,
      },
    });
  };

  try {
    const cached = await deps.readCache(log);

    if (cached && deps.isCacheValid(cached, CACHE_TTL_MS, log)) {
      client.app.log({
        body: {
          service: SERVICE_NAME,
          level: 'info',
          message: 'Cache is still valid, skipping sync',
          extra: {
            lastSync: new Date(cached.timestamp).toISOString(),
            modelCount: cached.models.length,
          },
        },
      });
      return;
    }

    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: 'info',
        message: 'Starting OpenRouter model sync',
      },
    });

    const config = await deps.readConfig(log);
    const apiUrl = getApiUrlFromConfig(config);

    const modelsResult = await deps.fetchModels(
      apiUrl ? { apiUrl, log } : { log },
    );

    if ('error' in modelsResult) {
      client.app.log({
        body: {
          service: SERVICE_NAME,
          level: 'warn',
          message: `Failed to fetch models from OpenRouter API: ${modelsResult.error.message}`,
        },
      });
      return;
    }

    const models = modelsResult.data;

    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: 'info',
        message: `Fetched ${models.length} models from OpenRouter API`,
      },
    });

    const result = await deps.updateModels(models, undefined, log);

    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: 'info',
        message: 'Model sync completed',
        extra: {
          added: result.added,
          skipped: result.skipped,
          removed: result.removed,
        },
      },
    });

    await deps.writeCache(
      {
        models,
        timestamp: Date.now(),
      },
      log,
    );

    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: 'info',
        message: 'Cache updated successfully',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: 'error',
        message: 'Error during model sync',
        extra: {
          error: errorMessage,
        },
      },
    });
  }
}

export default async function OpenRouterModelSyncPlugin(ctx: PluginContext) {
  const { client } = ctx;

  client.app.log({
    body: {
      service: SERVICE_NAME,
      level: 'info',
      message: 'OpenRouter Model Sync plugin installed',
      extra: {
        notification: true,
        title: 'OpenRouter Model Sync',
        description:
          'Plugin installed successfully. Models will sync automatically every 24 hours.',
      },
    },
  });
  performSync(ctx).catch((err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: 'error',
        message: 'Error during model sync',
        extra: {
          error: errorMessage,
        },
      },
    });
  });
}
