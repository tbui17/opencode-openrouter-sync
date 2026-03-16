/**
 * Config utilities for OpenRouter Model Sync Plugin
 */

import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { homedir } from 'os';
import { dirname, join } from 'path';
import type { OpenCodeModelEntry, OpenRouterModel } from './types.js';
import { stripJsonComments } from './jsonc.js';

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
 * Get the global OpenCode config path (sync, for backward compat)
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
 * Resolve the global config path, preferring .jsonc over .json
 * @param customPath - Optional custom path (returned as-is if provided)
 * @returns Resolved path to the config file
 */
export async function resolveGlobalConfigPath(customPath?: string): Promise<string> {
  if (customPath) {
    return customPath;
  }
  const configDir = join(homedir(), '.config', 'opencode');
  const jsoncPath = join(configDir, 'opencode.jsonc');
  if (await fileExists(jsoncPath)) {
    return jsoncPath;
  }
  return join(configDir, 'opencode.json');
}

/**
 * Read and parse the OpenCode config file
 * Supports JSONC (JSON with comments). Creates a default config if file doesn't exist.
 * @param configPath - Optional custom path for testing
 * @param log - Optional logging function
 * @returns Parsed config object or null if malformed
 */
export async function readConfig(
  configPath?: string,
  log?: (msg: string) => void
): Promise<Record<string, unknown> | null> {
  const path = configPath ?? await resolveGlobalConfigPath();

  try {
    const exists = await fileExists(path);

    if (!exists) {
      log?.(`Config file not found at ${path}, creating default config`);
      return { ...DEFAULT_CONFIG };
    }

    const content = await readFile(path, 'utf-8');
    const stripped = stripJsonComments(content);
    const parsed = JSON.parse(stripped) as Record<string, unknown>;

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
  log?: (msg: string) => void,
  options?: { merge?: boolean }
): Promise<boolean> {
  const path = configPath ?? await resolveGlobalConfigPath();
  const shouldMerge = options?.merge !== false; // default true for backward compat

  try {
    // Ensure directory exists
    const configDir = dirname(path);
    await mkdir(configDir, { recursive: true });

    let finalConfig: Record<string, unknown>;

    if (shouldMerge) {
      // Read existing config to merge (if it exists and is valid)
      const existing = await readConfig(configPath, log);
      if (existing) {
        // Deep merge: existing config takes precedence, new values are added
        finalConfig = deepMerge(existing, config);
      } else {
        finalConfig = config;
      }
    } else {
      finalConfig = config;
    }

    // Write with pretty formatting (2-space indent)
    const content = JSON.stringify(finalConfig, null, 2);
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
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    if (key in result) {
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
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      }
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Convert OpenRouter model to OpenCode model entry
 * Produces fields matching OpenCode's ModelsDev.Model schema
 */
export function convertToConfigModel(model: OpenRouterModel): OpenCodeModelEntry {
  const entry: OpenCodeModelEntry = {};

  if (model.name) {
    entry.name = model.name;
  }

  // cost: pricing strings → numbers
  if (model.pricing) {
    const input = parseFloat(model.pricing.prompt);
    const output = parseFloat(model.pricing.completion);
    const cacheRead = parseFloat(model.pricing.input_cache_read);

    const cost: OpenCodeModelEntry['cost'] = {};
    if (!isNaN(input)) cost.input = input;
    if (!isNaN(output)) cost.output = output;
    if (!isNaN(cacheRead)) cost.cache_read = cacheRead;

    if (Object.keys(cost).length > 0) {
      entry.cost = cost;
    }
  }

  // limit: context and output tokens
  const limit: OpenCodeModelEntry['limit'] = {};
  if (model.context_length > 0) {
    limit.context = model.context_length;
  }
  if (model.top_provider?.max_completion_tokens) {
    limit.output = model.top_provider.max_completion_tokens;
  }
  if (Object.keys(limit).length > 0) {
    entry.limit = limit;
  }

  // modalities from architecture
  if (model.architecture) {
    const modalities: OpenCodeModelEntry['modalities'] = {};
    if (model.architecture.input_modalities?.length) {
      modalities.input = model.architecture.input_modalities;
    }
    if (model.architecture.output_modalities?.length) {
      modalities.output = model.architecture.output_modalities;
    }
    if (Object.keys(modalities).length > 0) {
      entry.modalities = modalities;
    }
  }

  // Boolean capability flags from supported_parameters
  if (model.supported_parameters?.length) {
    const params = model.supported_parameters;

    if (params.includes('temperature')) {
      entry.temperature = true;
    }
    if (params.includes('tools') || params.includes('tool_choice')) {
      entry.tool_call = true;
    }
    if (params.includes('reasoning') || params.includes('reasoning_effort')) {
      entry.reasoning = true;
    }
  }

  // attachment: input modalities contain image or pdf
  if (model.architecture?.input_modalities?.length) {
    const inputs = model.architecture.input_modalities;
    if (inputs.includes('image') || inputs.includes('pdf')) {
      entry.attachment = true;
    }
  }

  return entry;
}

/**
 * Update models in the config with new OpenRouter models
 * Adds models that don't exist, and removes models no longer in the API response.
 * The API is treated as the source of truth for the openrouter provider.
 */
export async function updateModels(
  models: OpenRouterModel[],
  configPath?: string,
  log?: (msg: string) => void
): Promise<{ added: number; skipped: number; removed: number }> {
  const config = await readConfig(configPath, log);

  if (!config) {
    log?.('Failed to read config, cannot update models');
    return { added: 0, skipped: 0, removed: 0 };
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

  // Build a set of valid model IDs from the API response
  const apiModelIds = new Set(models.map(m => m.id).filter(Boolean));

  let added = 0;
  let skipped = 0;
  let removed = 0;

  // Remove models no longer present in the API response
  for (const existingId of Object.keys(existingModels)) {
    if (!apiModelIds.has(existingId)) {
      delete existingModels[existingId];
      removed++;
      log?.(`Removed stale model: ${existingId}`);
    }
  }

  // Add new models
  for (const model of models) {
    if (!model.id) {
      log?.('Skipping model without ID');
      skipped++;
      continue;
    }

    if (model.id in existingModels) {
      log?.(`Model ${model.id} already exists, skipping`);
      skipped++;
      continue;
    }

    const modelEntry = convertToConfigModel(model);
    existingModels[model.id] = modelEntry;
    added++;
    log?.(`Added model: ${model.id}`);
  }

  const success = await writeConfig(config, configPath, log, { merge: false });

  if (!success) {
    log?.('Failed to write config after updating models');
    return { added: 0, skipped: models.length, removed: 0 };
  }

  return { added, skipped, removed };
}
