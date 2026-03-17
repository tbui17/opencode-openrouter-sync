import { clearCache, readCache, writeCache, isCacheValid, getCachePath } from './cache.js';
import { fetchModels } from './api.js';
import { updateModels, readConfig, writeConfig, getGlobalConfigPath, resolveGlobalConfigPath } from './config.js';

export { clearCache, readCache, writeCache, isCacheValid, getCachePath };
export { fetchModels, updateModels, readConfig, writeConfig, getGlobalConfigPath, resolveGlobalConfigPath };

export async function syncModels(log?: (msg: string) => void): Promise<{ added: number; skipped: number }> {
  log?.('Starting model sync');
  const result = await fetchModels({ log });

  if ('error' in result) {
    log?.(`Model fetch failed: [${result.error.type}] ${result.error.message}`);
    return { added: 0, skipped: 0 };
  }

  log?.(`Fetched ${result.data.length} models, updating config`);
  const updateResult = await updateModels(result.data, undefined, log);
  log?.(`Sync complete: added=${updateResult.added}, skipped=${updateResult.skipped}, removed=${updateResult.removed}`);
  return updateResult;
}
