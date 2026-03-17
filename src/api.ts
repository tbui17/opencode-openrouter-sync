/**
 * OpenRouter API client
 * Fetches available models from OpenRouter's public API
 */

import type { OpenRouterModel, OpenRouterResponse, FetchResult } from './types';

const DEFAULT_API_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const DEFAULT_TIMEOUT_MS = 30000;

export interface FetchModelsOptions {
  apiUrl?: string;
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

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
      console.error(
        `${ErrorMessages.NETWORK_ERROR}: HTTP ${response.status} ${response.statusText}`
      );
      return {
        error: {
          type: 'http',
          message: `${ErrorMessages.NETWORK_ERROR}: HTTP ${response.status} ${response.statusText}`,
          status: response.status,
          details,
        },
      };
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error(ErrorMessages.PARSE_ERROR, parseError);
      return {
        error: {
          type: 'parse',
          message: ErrorMessages.PARSE_ERROR,
          details: parseError,
        },
      };
    }

    if (!isValidOpenRouterResponse(data)) {
      console.error(ErrorMessages.INVALID_RESPONSE);
      return {
        error: {
          type: 'validation',
          message: ErrorMessages.INVALID_RESPONSE,
          details: data,
        },
      };
    }

    if (data.data.length === 0) {
      console.error(ErrorMessages.EMPTY_DATA);
      return {
        error: {
          type: 'empty',
          message: ErrorMessages.EMPTY_DATA,
        },
      };
    }

    return { data: data.data };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(ErrorMessages.TIMEOUT);
        return {
          error: {
            type: 'timeout',
            message: ErrorMessages.TIMEOUT,
          },
        };
      } else {
        console.error(`${ErrorMessages.NETWORK_ERROR}: ${error.message}`);
        return {
          error: {
            type: 'network',
            message: `${ErrorMessages.NETWORK_ERROR}: ${error.message}`,
            details: error,
          },
        };
      }
    } else {
      console.error(ErrorMessages.UNKNOWN, error);
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
