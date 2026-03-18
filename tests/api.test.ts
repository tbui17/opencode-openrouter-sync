import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { fetchModels } from '../src/api';
import type { OpenRouterModel, OpenRouterResponse } from '../src/types';

// Helper to create valid mock model
function createMockModel(
  overrides: Partial<OpenRouterModel> = {},
): OpenRouterModel {
  return {
    id: 'test-model-1',
    canonical_slug: 'test-model-1',
    hugging_face_id: 'test/model-1',
    name: 'Test Model 1',
    created: 1700000000,
    description: 'A test model',
    context_length: 4096,
    architecture: {
      modality: 'text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'test-tokenizer',
      instruct_type: 'chat',
    },
    pricing: {
      prompt: '0.001',
      completion: '0.002',
      input_cache_read: '0.0001',
    },
    top_provider: {
      context_length: 4096,
      max_completion_tokens: 4096,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: ['temperature', 'max_tokens'],
    default_parameters: {
      temperature: 0.7,
      top_p: null,
      top_k: null,
      frequency_penalty: null,
      presence_penalty: null,
      repetition_penalty: null,
    },
    expiration_date: null,
    ...overrides,
  };
}

// Helper to create valid API response
function createMockResponse(
  models: OpenRouterModel[] = [createMockModel()],
): OpenRouterResponse {
  return { data: models };
}

describe('fetchModels', () => {
  // Store original fetch to restore after tests
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns FetchResult with data on successful API call', async () => {
    const mockModels = [
      createMockModel({ id: 'model-1', name: 'Model One' }),
      createMockModel({ id: 'model-2', name: 'Model Two' }),
    ];

    // Mock successful fetch response
    global.fetch = mock(async () => {
      return {
        ok: true,
        json: async () => createMockResponse(mockModels),
      } as Response;
    });

    const result = await fetchModels();

    expect('data' in result).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('model-1');
    expect(result.data[1].id).toBe('model-2');
  });

  test('returns FetchResult with error on network error', async () => {
    // Mock network error
    global.fetch = mock(async () => {
      throw new Error('Network connection failed');
    });

    const result = await fetchModels();

    expect('error' in result).toBe(true);
    expect(result.error.type).toBe('network');
  });

  test('returns FetchResult with error on timeout (AbortError)', async () => {
    // Mock timeout - AbortError
    global.fetch = mock(async () => {
      const error = new Error('Request timed out');
      error.name = 'AbortError';
      throw error;
    });

    const result = await fetchModels();

    expect('error' in result).toBe(true);
    expect(result.error.type).toBe('timeout');
  });

  test('returns FetchResult with error on malformed JSON response', async () => {
    // Mock response with invalid JSON
    global.fetch = mock(async () => {
      return {
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token in JSON');
        },
      } as Response;
    });

    const result = await fetchModels();

    expect('error' in result).toBe(true);
    expect(result.error.type).toBe('parse');
  });

  test('returns FetchResult with error when response lacks data array', async () => {
    // Mock response with invalid structure (missing data array)
    global.fetch = mock(async () => {
      return {
        ok: true,
        json: async () => ({ error: 'Some error' }),
      } as Response;
    });

    const result = await fetchModels();

    expect('error' in result).toBe(true);
    expect(result.error.type).toBe('validation');
  });

  test('returns FetchResult with error when data array is empty', async () => {
    // Mock response with empty data array
    global.fetch = mock(async () => {
      return {
        ok: true,
        json: async () => createMockResponse([]),
      } as Response;
    });

    const result = await fetchModels();

    expect('error' in result).toBe(true);
    expect(result.error.type).toBe('empty');
  });

  test('returns FetchResult with error when HTTP status is not ok', async () => {
    // Mock 500 error response
    global.fetch = mock(async () => {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Internal Server Error',
      } as Response;
    });

    const result = await fetchModels();

    expect('error' in result).toBe(true);
    expect(result.error.type).toBe('http');
    expect(result.error.status).toBe(500);
  });

  test('returns FetchResult with error when model missing required fields', async () => {
    // Mock response with invalid model (missing required fields)
    const invalidModel = createMockModel();
    delete (invalidModel as Partial<OpenRouterModel>).context_length;

    global.fetch = mock(async () => {
      return {
        ok: true,
        json: async () => createMockResponse([invalidModel]),
      } as Response;
    });

    const result = await fetchModels();

    expect('error' in result).toBe(true);
    expect(result.error.type).toBe('validation');
  });

  test('returns FetchResult with error on non-object response', async () => {
    // Mock response returning non-object
    global.fetch = mock(async () => {
      return {
        ok: true,
        json: async () => 'not an object',
      } as Response;
    });

    const result = await fetchModels();

    expect('error' in result).toBe(true);
    expect(result.error.type).toBe('validation');
  });
});
