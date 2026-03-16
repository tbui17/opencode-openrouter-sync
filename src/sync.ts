import { clearCache, readCache, writeCache, isCacheValid, getCachePath } from './cache.js';
import { fetchModels } from './api.js';
import { updateModels, readConfig, writeConfig, getGlobalConfigPath } from './config.js';

export { clearCache, readCache, writeCache, isCacheValid, getCachePath };
export { fetchModels, updateModels, readConfig, writeConfig, getGlobalConfigPath };

export async function syncModels(): Promise<{ added: number; skipped: number }> {
  const models = await fetchModels();

  if (!models) {
    return { added: 0, skipped: 0 };
  }

  return updateModels(models);
}
