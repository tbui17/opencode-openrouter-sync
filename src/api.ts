/**
 * OpenRouter API client
 * Fetches available models from OpenRouter's public API
 */

import type { OpenRouterModel, OpenRouterResponse, FetchResult } from './types';

const DEFAULT_API_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const DEFAULT_TIMEOUT_MS = 30000;

export interface FetchModelsOptions {
  apiUrl?: string;
  log?: (msg: string) => void;
}

const ErrorMessages = {
  NETWORK_ERROR: 'Network error while fetching OpenRouter models',
  TIMEOUT: 'Request timed out after 30 seconds',
  INVALID_RESPONSE: 'Invalid response structure from OpenRouter API',
  EMPTY_DATA: 'OpenRouter API returned empty data array',
  PARSE_ERROR: 'Failed to parse OpenRouter API response',
  UNKNOWN: 'Unknown error occurred while fetching OpenRouter models',
} as const;

function getApiEndpoint(options?: FetchModelsOptions): string {
  if (options?.apiUrl) {
    return options.apiUrl;
  }
  return process.env.OPENROUTER_API_URL ?? DEFAULT_API_ENDPOINT;
}

export async function fetchModels(options: FetchModelsOptions = {}): Promise<FetchResult> {
  const endpoint = getApiEndpoint(options);
  const log = options.log;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  log?.(`Fetching models from ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let details: unknown = undefined;
      try {
        const body = await response.text();
        details = body;
      } catch {
        // Ignore errors reading body
      }
      const msg = `${ErrorMessages.NETWORK_ERROR}: HTTP ${response.status} ${response.statusText}`;
      log?.(msg);
      return {
        error: {
          type: 'http',
          message: msg,
          status: response.status,
          details,
        },
      };
    }

    log?.(`Received HTTP ${response.status} response, parsing JSON`);

    let data: unknown;
    try {
      data = await response.json();
    } catch (parseError) {
      log?.(`${ErrorMessages.PARSE_ERROR}: ${parseError}`);
      return {
        error: {
          type: 'parse',
          message: ErrorMessages.PARSE_ERROR,
          details: parseError,
        },
      };
    }

    if (!isValidOpenRouterResponse(data)) {
      log?.(ErrorMessages.INVALID_RESPONSE);
      return {
        error: {
          type: 'validation',
          message: ErrorMessages.INVALID_RESPONSE,
          details: data,
        },
      };
    }

    if (data.data.length === 0) {
      log?.(ErrorMessages.EMPTY_DATA);
      return {
        error: {
          type: 'empty',
          message: ErrorMessages.EMPTY_DATA,
        },
      };
    }

    log?.(`Successfully fetched ${data.data.length} models`);
    return { data: data.data };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        log?.(ErrorMessages.TIMEOUT);
        return {
          error: {
            type: 'timeout',
            message: ErrorMessages.TIMEOUT,
          },
        };
      } else {
        const msg = `${ErrorMessages.NETWORK_ERROR}: ${error.message}`;
        log?.(msg);
        return {
          error: {
            type: 'network',
            message: msg,
            details: error,
          },
        };
      }
    } else {
      log?.(`${ErrorMessages.UNKNOWN}: ${error}`);
      return {
        error: {
          type: 'network',
          message: ErrorMessages.UNKNOWN,
          details: error,
        },
      };
    }
  }
}

/**
 * Type guard to validate OpenRouter API response structure
 */
function isValidOpenRouterResponse(data: unknown): data is OpenRouterResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const response = data as Record<string, unknown>;

  if (!Array.isArray(response.data)) {
    return false;
  }

  return response.data.every((item: unknown) => isValidOpenRouterModel(item));
}

/**
 * Type guard to validate individual model structure
 */
function isValidOpenRouterModel(model: unknown): model is OpenRouterModel {
  if (typeof model !== 'object' || model === null) {
    return false;
  }

  const m = model as Record<string, unknown>;

  const requiredFields = [
    'id',
    'name',
    'created',
    'context_length',
    'architecture',
    'pricing',
  ];

  for (const field of requiredFields) {
    if (!(field in m)) {
      return false;
    }
  }

  if (typeof m.id !== 'string') return false;
  if (typeof m.name !== 'string') return false;
  if (typeof m.created !== 'number') return false;
  if (typeof m.context_length !== 'number') return false;
  if (typeof m.architecture !== 'object' || m.architecture === null) return false;
  if (typeof m.pricing !== 'object' || m.pricing === null) return false;

  return true;
}
