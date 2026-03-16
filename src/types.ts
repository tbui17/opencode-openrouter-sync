/**
 * Type definitions for OpenRouter Model Sync Plugin
 */

interface OpenCodeClient {
  app: {
    log: (msg: unknown) => void;
  };
  config: {
    get: () => Promise<Record<string, unknown>>;
    set: (config: Record<string, unknown>) => Promise<void>;
  };
}

/**
 * Model architecture configuration
 */
export interface ModelArchitecture {
  modality: string;
  input_modalities: string[];
  output_modalities: string[];
  tokenizer: string;
  instruct_type: string | null;
}

/**
 * Model pricing information
 */
export interface ModelPricing {
  prompt: string;
  completion: string;
  input_cache_read: string;
  [key: string]: string;
}

/**
 * Top provider information
 */
export interface TopProvider {
  context_length: number;
  max_completion_tokens: number;
  is_moderated: boolean;
}

/**
 * Default parameters for the model
 */
export interface DefaultParameters {
  temperature: number | null;
  top_p: number | null;
  top_k: number | null;
  frequency_penalty: number | null;
  presence_penalty: number | null;
  repetition_penalty: number | null;
}

/**
 * OpenRouter API model response structure
 * Matches https://openrouter.ai/api/v1/models response
 */
export interface OpenRouterModel {
  id: string;
  canonical_slug: string;
  hugging_face_id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: ModelArchitecture;
  pricing: ModelPricing;
  top_provider: TopProvider;
  per_request_limits: string | null;
  supported_parameters: string[];
  default_parameters: DefaultParameters;
  expiration_date: number | null;
}

/**
 * OpenRouter API response wrapper
 */
export interface OpenRouterResponse {
  data: OpenRouterModel[];
}

/**
 * Cache data structure for storing fetched models
 */
export interface CacheData {
  models: OpenRouterModel[];
  timestamp: number;
}

/**
 * Sync configuration for the plugin
 */
export interface SyncConfig {
  cacheDir: string;
  cacheFile: string;
  cacheTtlMs: number;
  apiEndpoint: string;
  apiTimeout: number;
  globalConfigPath: string;
}

/**
 * Plugin options for customization
 */
export interface PluginOptions {
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Custom cache TTL in milliseconds (default: 24 hours) */
  cacheTtlMs?: number;
  /** Custom API timeout in milliseconds (default: 30000ms) */
  apiTimeout?: number;
  /** Filter models by provider (e.g., 'openai', 'anthropic') */
  providerFilter?: string[];
  /** Include reasoning models */
  includeReasoning?: boolean;
  /** Run sync on startup (default: true) */
  runOnStartup?: boolean;
}

/**
 * OpenCode plugin context type
 */
export type PluginContext = {
  client: OpenCodeClient;
};

/**
 * Sync result for return value
 */
export interface SyncResult {
  success: boolean;
  modelsAdded: number;
  modelsSkipped: number;
  error?: string;
}

/**
 * Model filter options for sync
 */
export interface ModelFilter {
  /** Minimum context length to include */
  minContextLength?: number;
  /** Include only text models */
  textOnly?: boolean;
  /** Include reasoning models */
  includeReasoning?: boolean;
  /** Provider whitelist */
  providers?: string[];
}

/**
 * Model entry matching OpenCode's ModelsDev.Model schema
 */
export interface OpenCodeModelEntry {
  name?: string;
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
  modalities?: {
    input?: string[];
    output?: string[];
  };
  temperature?: boolean;
  tool_call?: boolean;
  reasoning?: boolean;
  attachment?: boolean;
  options?: Record<string, unknown>;
  variants?: Record<string, unknown>;
  status?: string;
}

/**
 * @deprecated Use OpenCodeModelEntry instead. This alias exists for backward compatibility.
 */
export type ConfigModelEntry = OpenCodeModelEntry;
