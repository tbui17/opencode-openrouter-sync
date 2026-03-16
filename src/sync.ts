import { clearCache, readCache, writeCache, isCacheValid, getCachePath } from './cache.js';
import { fetchModels } from './api.js';
import { updateModels, readConfig, writeConfig, getGlobalConfigPath, resolveGlobalConfigPath } from './config.js';

export { clearCache, readCache, writeCache, isCacheValid, getCachePath };
export { fetchModels, updateModels, readConfig, writeConfig, getGlobalConfigPath, resolveGlobalConfigPath };

export async function syncModels(): Promise<{ added: number; skipped: number }> {
  const result = await fetchModels();

  if ('error' in result) {
    return { added: 0, skipped: 0 };
  }

  return updateModels(result.data);
}
