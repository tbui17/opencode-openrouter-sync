/**
 * OpenRouter Model Sync Plugin - Entry Point
 *
 * This plugin automatically syncs available models from OpenRouter's public API
 * to the global OpenCode configuration. It runs once per 24 hours on startup.
 */

import type { PluginContext, CacheData, OpenRouterModel } from "./types.js";
import { readCache, writeCache, isCacheValid } from "./cache.js";
import { fetchModels } from "./api.js";
import { updateModels } from "./config.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SERVICE_NAME = "openrouter-sync";

/**
 * Injectable dependencies for performSync, enabling testability
 */
export interface SyncDeps {
  readCache: () => Promise<CacheData | null>;
  writeCache: (data: CacheData) => Promise<void>;
  isCacheValid: (data: CacheData | null, ttlMs: number) => boolean;
  fetchModels: () => Promise<OpenRouterModel[] | null>;
  updateModels: (
    models: OpenRouterModel[],
    configPath?: string,
    log?: (msg: string) => void,
  ) => Promise<{ added: number; skipped: number; removed: number }>;
}

const defaultDeps: SyncDeps = {
  readCache: () => readCache(),
  writeCache: (data) => writeCache(data),
  isCacheValid: (data, ttlMs) => isCacheValid(data, ttlMs),
  fetchModels: () => fetchModels(),
  updateModels: (models, configPath, log) =>
    updateModels(models, configPath, log),
};

export async function performSync(
  ctx: PluginContext,
  deps: SyncDeps = defaultDeps,
): Promise<void> {
  const { client } = ctx;

  try {
    const cached = await deps.readCache();

    if (cached && deps.isCacheValid(cached, CACHE_TTL_MS)) {
      client.app.log({
        body: {
          service: SERVICE_NAME,
          level: "info",
          message: "Cache is still valid, skipping sync",
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
        level: "info",
        message: "Starting OpenRouter model sync",
      },
    });

    const models = await deps.fetchModels();

    if (!models) {
      client.app.log({
        body: {
          service: SERVICE_NAME,
          level: "warn",
          message: "Failed to fetch models from OpenRouter API",
        },
      });
      return;
    }

    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: "info",
        message: `Fetched ${models.length} models from OpenRouter API`,
      },
    });

    const result = await deps.updateModels(
      models,
      undefined,
      async (msg: string) => {
        client.app.log({
          body: {
            service: SERVICE_NAME,
            level: "debug",
            message: msg,
          },
        });
      },
    );

    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: "info",
        message: "Model sync completed",
        extra: {
          added: result.added,
          skipped: result.skipped,
          removed: result.removed,
        },
      },
    });

    await deps.writeCache({
      models,
      timestamp: Date.now(),
    });

    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: "info",
        message: "Cache updated successfully",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    client.app.log({
      body: {
        service: SERVICE_NAME,
        level: "error",
        message: "Error during model sync",
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
      level: "info",
      message: "OpenRouter Model Sync plugin initialized",
    },
  });

  return {
    "session.created": async () => {
      performSync(ctx).catch(() => {
        // Errors are already logged in performSync
      });
    },
  };
}
