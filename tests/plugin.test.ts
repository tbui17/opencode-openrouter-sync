import { describe, expect, mock, test } from 'bun:test';
import { performSync, type SyncDeps } from '../src/plugin';
import type { CacheData, OpenRouterModel, PluginContext } from '../src/types';

function createMockCtx(): { ctx: PluginContext; logs: unknown[] } {
  const logs: unknown[] = [];
  const ctx: PluginContext = {
    client: {
      app: {
        log: (msg: unknown) => logs.push(msg),
      },
      config: {
        get: async () => ({}),
        set: async () => {},
      },
    },
  };
  return { ctx, logs };
}

function createMockModel(id: string): OpenRouterModel {
  return {
    id,
    canonical_slug: id,
    hugging_face_id: '',
    name: `Model ${id}`,
    created: Date.now(),
    description: '',
    context_length: 4096,
    architecture: {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'gpt-4',
      instruct_type: null,
    },
    pricing: { prompt: '0.001', completion: '0.002', input_cache_read: '0' },
    top_provider: {
      context_length: 4096,
      max_completion_tokens: 4096,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: ['temperature'],
    default_parameters: {
      temperature: 0.7,
      top_p: null,
      top_k: null,
      frequency_penalty: null,
      presence_penalty: null,
      repetition_penalty: null,
    },
    expiration_date: null,
  } as OpenRouterModel;
}

function createDeps(overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    readCache: mock(async () => null),
    writeCache: mock(async () => {}),
    isCacheValid: mock(() => false),
    fetchModels: mock(async () => ({ data: [createMockModel('test/model')] })),
    updateModels: mock(async () => ({ added: 1, skipped: 0, removed: 0 })),
    readConfig: mock(async () => null),
    ...overrides,
  };
}

describe('performSync', () => {
  test('skips sync when cache is valid', async () => {
    const { ctx, logs } = createMockCtx();
    const cached: CacheData = {
      models: [createMockModel('m')],
      timestamp: Date.now(),
    };
    const deps = createDeps({
      readCache: mock(async () => cached),
      isCacheValid: mock(() => true),
    });

    await performSync(ctx, deps);

    expect(deps.fetchModels).not.toHaveBeenCalled();
    const messages = logs.map((l: any) => l.body?.message);
    expect(messages).toContain('Cache is still valid, skipping sync');
  });

  test('fetches and updates when cache is expired', async () => {
    const { ctx, logs } = createMockCtx();
    const models = [createMockModel('new/model')];
    const deps = createDeps({
      fetchModels: mock(async () => ({ data: models })),
      updateModels: mock(async () => ({ added: 1, skipped: 0, removed: 0 })),
    });

    await performSync(ctx, deps);

    expect(deps.fetchModels).toHaveBeenCalled();
    expect(deps.updateModels).toHaveBeenCalled();
    expect(deps.writeCache).toHaveBeenCalled();
    const messages = logs.map((l: any) => l.body?.message);
    expect(messages).toContain('Model sync completed');
    expect(messages).toContain('Cache updated successfully');
  });

  test('logs warning when fetch fails', async () => {
    const { ctx, logs } = createMockCtx();
    const deps = createDeps({
      fetchModels: mock(async () => ({
        error: { type: 'network' as const, message: 'Network error' },
      })),
    });

    await performSync(ctx, deps);

    expect(deps.updateModels).not.toHaveBeenCalled();
    const messages = logs.map((l: any) => l.body?.message);
    expect(
      messages.some((m: string) => m.includes('Failed to fetch models')),
    ).toBe(true);
  });

  test('logs error when updateModels throws', async () => {
    const { ctx, logs } = createMockCtx();
    const deps = createDeps({
      updateModels: mock(async () => {
        throw new Error('write failed');
      }),
    });

    await performSync(ctx, deps);

    const messages = logs.map((l: any) => l.body?.message);
    expect(messages).toContain('Error during model sync');
    const errorLog = logs.find(
      (l: any) => l.body?.message === 'Error during model sync',
    ) as any;
    expect(errorLog.body.extra.error).toBe('write failed');
  });

  test('writes cache after successful sync', async () => {
    const { ctx } = createMockCtx();
    const writeCacheMock = mock(async () => {});
    const deps = createDeps({ writeCache: writeCacheMock });

    await performSync(ctx, deps);

    expect(writeCacheMock).toHaveBeenCalledTimes(1);
    const arg = writeCacheMock.mock.calls[0][0] as CacheData;
    expect(arg.models).toHaveLength(1);
    expect(arg.timestamp).toBeGreaterThan(0);
  });

  test('does not write cache when fetch returns null', async () => {
    const { ctx } = createMockCtx();
    const writeCacheMock = mock(async () => {});
    const deps = createDeps({
      fetchModels: mock(async () => ({
        error: { type: 'network' as const, message: 'Network error' },
      })),
      writeCache: writeCacheMock,
    });

    await performSync(ctx, deps);

    expect(writeCacheMock).not.toHaveBeenCalled();
  });
});

describe('OpenRouterModelSyncPlugin', () => {
  test('plugin init logs installed notification', async () => {
    const { default: plugin } = await import('../src/plugin');
    const { ctx, logs } = createMockCtx();

    const handlers = await plugin(ctx);

    const messages = logs.map((l: any) => l.body?.message);
    expect(messages).toContain('OpenRouter Model Sync plugin installed');
    const notification = logs.find(
      (l: any) => l.body?.message === 'OpenRouter Model Sync plugin installed',
    ) as any;
    expect(notification.body.extra.notification).toBe(true);
    expect(notification.body.extra.title).toBe('OpenRouter Model Sync');
    expect(notification.body.extra.description).toContain(
      'Plugin installed successfully',
    );
    expect(handlers['session.created']).toBeFunction();
  });
});
