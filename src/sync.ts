import { fetchModels } from './api.js';
import {
  clearCache,
  getCachePath,
  isCacheValid,
  readCache,
  writeCache,
} from './cache.js';
import {
  getGlobalConfigPath,
  readConfig,
  resolveGlobalConfigPath,
  updateModels,
  writeConfig,
} from './config.js';

export {
  clearCache,
  fetchModels,
  getCachePath,
  getGlobalConfigPath,
  isCacheValid,
  readCache,
  readConfig,
  resolveGlobalConfigPath,
  updateModels,
  writeCache,
  writeConfig,
};

export async function syncModels(
  log?: (msg: string) => void,
): Promise<{ added: number; skipped: number }> {
  log?.('Starting model sync');
  const result = await fetchModels({ log });

  if ('error' in result) {
    log?.(`Model fetch failed: [${result.error.type}] ${result.error.message}`);
    return { added: 0, skipped: 0 };
  }

  log?.(`Fetched ${result.data.length} models, updating config`);
  const updateResult = await updateModels(result.data, undefined, log);
  log?.(
    `Sync complete: added=${updateResult.added}, skipped=${updateResult.skipped}, removed=${updateResult.removed}`,
  );
  return updateResult;
}
