/**
 * Config utilities for OpenRouter Model Sync Plugin
 */

import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { homedir } from 'os';
import { dirname, join } from 'path';
import type { ConfigModelEntry, OpenRouterModel } from './types.js';

/**
 * Useful LLM parameters that can be filtered from OpenRouter API
 */
export const USEFUL_PARAMETERS = [
  'tools',
  'tool_choice',
  'temperature',
  'top_p',
  'max_tokens',
  'reasoning',
  'reasoning_effort',
  'include_reasoning',
  'web_search_options',
  'response_format',
  'structured_outputs'
] as const;

/**
 * Default configuration structure
 */
const DEFAULT_CONFIG: Record<string, unknown> = {
  provider: {
    openrouter: {
      models: {}
    }
  }
};

/**
 * Get the global OpenCode config path
 * @param customPath - Optional custom path for testing
 * @returns Path to ~/.config/opencode/opencode.json or custom path
 */
export function getGlobalConfigPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  return join(homedir(), '.config', 'opencode', 'opencode.json');
}

/**
 * Check if a file exists
 * @param path - File path to check
 * @returns True if file exists, false otherwise
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse the OpenCode config file
 * Creates a default config if file doesn't exist
 * @param configPath - Optional custom path for testing
 * @param log - Optional logging function
 * @returns Parsed config object or null if malformed
 */
export async function readConfig(
  configPath?: string,
  log?: (msg: string) => void
): Promise<Record<string, unknown> | null> {
  const path = configPath || getGlobalConfigPath();

  try {
    const exists = await fileExists(path);

    if (!exists) {
      log?.(`Config file not found at ${path}, creating default config`);
      return { ...DEFAULT_CONFIG };
    }

    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Ensure provider.openrouter.models exists
    if (!parsed.provider) {
      parsed.provider = {};
    }
    const provider = parsed.provider as Record<string, unknown>;

    if (!provider.openrouter) {
      provider.openrouter = {};
    }
    const openrouter = provider.openrouter as Record<string, unknown>;

    if (!openrouter.models || typeof openrouter.models !== 'object') {
      openrouter.models = {};
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      log?.(`Malformed JSON in config file: ${path}`);
      return null;
    }
    log?.(`Error reading config file: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Write config to the global OpenCode config file
 * Preserves existing structure and only modifies specified sections
 * @param config - Config object to write
 * @param configPath - Optional custom path for testing
 * @param log - Optional logging function
 * @returns True if successful, false otherwise
 */
export async function writeConfig(
  config: Record<string, unknown>,
  configPath?: string,
  log?: (msg: string) => void
): Promise<boolean> {
  const path = configPath || getGlobalConfigPath();

  try {
    // Ensure directory exists
    const configDir = dirname(path);
    await mkdir(configDir, { recursive: true });

    // Read existing config to merge (if it exists and is valid)
    const existing = await readConfig(configPath, log);
    let mergedConfig: Record<string, unknown>;

    if (existing) {
      // Deep merge: existing config takes precedence, new values are added
      mergedConfig = deepMerge(existing, config);
    } else {
      mergedConfig = config;
    }

    // Write with pretty formatting (2-space indent)
    const content = JSON.stringify(mergedConfig, null, 2);
    await writeFile(path, content, 'utf-8');

    return true;
  } catch (error) {
    log?.(`Error writing config file: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Deep merge two objects
 * Source properties are added if they don't exist in target
 * Target properties are never overwritten
 * @param target - Base object (existing config)
 * @param source - New values to merge in
 * @returns Merged object
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    if (key in result) {
      // Key exists in target - check if both are objects for recursive merge
      const targetValue = result[key];
      const sourceValue = source[key];

      if (
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue) &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue)
      ) {
        // Both are plain objects - recursive merge
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      }
      // Otherwise: keep target value (don't overwrite)
    } else {
      // Key doesn't exist - add from source
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Convert OpenRouter model to config model entry
 * @param model - OpenRouter model from API
 * @returns Config model entry
 */
export function convertToConfigModel(model: OpenRouterModel): ConfigModelEntry {
  const entry: ConfigModelEntry = {
    id: model.id,
    name: model.name,
    provider: 'openrouter'
  };

  if (model.context_length > 0) {
    entry.context_length = model.context_length;
  }

  if (model.pricing) {
    const promptPrice = parseFloat(model.pricing.prompt);
    const completionPrice = parseFloat(model.pricing.completion);

    if (!isNaN(promptPrice) || !isNaN(completionPrice)) {
      entry.pricing = {
        prompt: isNaN(promptPrice) ? 0 : promptPrice,
        completion: isNaN(completionPrice) ? 0 : completionPrice
      };
    }
  }

  // NEW: max_completion_tokens from top_provider (optional chaining)
  if (model.top_provider?.max_completion_tokens) {
    entry.max_completion_tokens = model.top_provider.max_completion_tokens;
  }

  // NEW: supported_parameters (filtered to useful subset)
  if (model.supported_parameters?.length) {
    const filtered = model.supported_parameters.filter(
      p => USEFUL_PARAMETERS.includes(p as typeof USEFUL_PARAMETERS[number])
    );
    if (filtered.length > 0) {
      entry.supported_parameters = filtered;
    }
  }

  // NEW: default_parameters (pass-through, preserve nulls)
  if (model.default_parameters) {
    entry.default_parameters = model.default_parameters;
  }

  // NEW: is_moderated (explicit boolean only, omit if undefined)
  if (model.top_provider?.is_moderated !== undefined) {
    entry.is_moderated = model.top_provider.is_moderated;
  }

  return entry;
}

/**
 * Update models in the config with new OpenRouter models
 * Only adds models that don't already exist - never overwrites
 * @param models - Models fetched from OpenRouter API
 * @param configPath - Optional custom path for testing
 * @param log - Optional logging function
 * @returns Object with added and skipped counts
 */
export async function updateModels(
  models: OpenRouterModel[],
  configPath?: string,
  log?: (msg: string) => void
): Promise<{ added: number; skipped: number }> {
  const config = await readConfig(configPath, log);

  if (!config) {
    log?.('Failed to read config, cannot update models');
    return { added: 0, skipped: 0 };
  }

  // Ensure provider.openrouter.models exists
  if (!config.provider) {
    config.provider = {};
  }
  const provider = config.provider as Record<string, unknown>;

  if (!provider.openrouter) {
    provider.openrouter = {};
  }
  const openrouter = provider.openrouter as Record<string, unknown>;

  if (!openrouter.models || typeof openrouter.models !== 'object') {
    openrouter.models = {};
  }
  const existingModels = openrouter.models as Record<string, unknown>;

  let added = 0;
  let skipped = 0;

  for (const model of models) {
    if (!model.id) {
      log?.('Skipping model without ID');
      skipped++;
      continue;
    }

    // Check if model already exists (by ID)
    if (model.id in existingModels) {
      log?.(`Model ${model.id} already exists, skipping`);
      skipped++;
      continue;
    }

    // Convert and add new model
    const modelEntry = convertToConfigModel(model);
    existingModels[model.id] = modelEntry;
    added++;
    log?.(`Added model: ${model.id}`);
  }

  // Write updated config
  const success = await writeConfig(config, configPath, log);

  if (!success) {
    log?.('Failed to write config after updating models');
    return { added: 0, skipped: models.length };
  }

  return { added, skipped };
}
