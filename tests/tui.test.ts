import { describe, expect, test } from 'bun:test';
import {
  AppendPromptOptionsSchema,
  createAppendPromptBody,
  createToastBody,
  ToastOptionsSchema,
  ToastVariantSchema,
} from '../src/tui';

describe('ToastVariantSchema', () => {
  test('accepts valid variants', () => {
    expect(ToastVariantSchema.parse('info')).toBe('info');
    expect(ToastVariantSchema.parse('success')).toBe('success');
    expect(ToastVariantSchema.parse('warning')).toBe('warning');
    expect(ToastVariantSchema.parse('error')).toBe('error');
  });

  test('rejects invalid variants', () => {
    expect(() => ToastVariantSchema.parse('invalid')).toThrow();
    expect(() => ToastVariantSchema.parse('INFO')).toThrow();
    expect(() => ToastVariantSchema.parse(123)).toThrow();
    expect(() => ToastVariantSchema.parse(null)).toThrow();
  });

  test('safeParse returns success for valid input', () => {
    const result = ToastVariantSchema.safeParse('success');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('success');
    }
  });

  test('safeParse returns error for invalid input', () => {
    const result = ToastVariantSchema.safeParse('invalid');
    expect(result.success).toBe(false);
  });
});

describe('ToastOptionsSchema', () => {
  test('parses minimal valid options', () => {
    const result = ToastOptionsSchema.parse({ message: 'Hello' });
    expect(result.message).toBe('Hello');
    expect(result.variant).toBe('info');
  });

  test('parses full options', () => {
    const result = ToastOptionsSchema.parse({
      message: 'Test',
      variant: 'success',
      title: 'Title',
      duration: 5000,
    });
    expect(result).toEqual({
      message: 'Test',
      variant: 'success',
      title: 'Title',
      duration: 5000,
    });
  });

  test('rejects missing message', () => {
    expect(() => ToastOptionsSchema.parse({})).toThrow();
    expect(() => ToastOptionsSchema.parse({ variant: 'success' })).toThrow();
  });

  test('accepts empty message string', () => {
    expect(() => ToastOptionsSchema.parse({ message: '' })).not.toThrow();
  });

  test('rejects negative duration', () => {
    expect(() =>
      ToastOptionsSchema.parse({ message: 'Test', duration: -100 }),
    ).toThrow();
  });

  test('rejects zero duration', () => {
    expect(() =>
      ToastOptionsSchema.parse({ message: 'Test', duration: 0 }),
    ).toThrow();
  });

  test('accepts positive duration', () => {
    const result = ToastOptionsSchema.parse({
      message: 'Test',
      duration: 1000,
    });
    expect(result.duration).toBe(1000);
  });

  test('rejects invalid variant', () => {
    expect(() =>
      ToastOptionsSchema.parse({ message: 'Test', variant: 'invalid' }),
    ).toThrow();
  });

  test('rejects non-string message', () => {
    expect(() => ToastOptionsSchema.parse({ message: 123 })).toThrow();
    expect(() => ToastOptionsSchema.parse({ message: null })).toThrow();
  });

  test('ignores extra fields', () => {
    const result = ToastOptionsSchema.parse({
      message: 'Test',
      extra: 'ignored',
    });
    expect(result).toEqual({ message: 'Test', variant: 'info' });
  });
});

describe('AppendPromptOptionsSchema', () => {
  test('parses valid options', () => {
    const result = AppendPromptOptionsSchema.parse({ text: 'Hello world' });
    expect(result).toEqual({ text: 'Hello world' });
  });

  test('rejects missing text', () => {
    expect(() => AppendPromptOptionsSchema.parse({})).toThrow();
  });

  test('rejects non-string text', () => {
    expect(() => AppendPromptOptionsSchema.parse({ text: 123 })).toThrow();
    expect(() => AppendPromptOptionsSchema.parse({ text: null })).toThrow();
    expect(() =>
      AppendPromptOptionsSchema.parse({ text: undefined }),
    ).toThrow();
  });

  test('accepts empty string', () => {
    const result = AppendPromptOptionsSchema.parse({ text: '' });
    expect(result.text).toBe('');
  });
});

describe('createToastBody', () => {
  test('wraps valid options', () => {
    const result = createToastBody({ message: 'Test', variant: 'success' });
    expect(result).toEqual({
      body: { message: 'Test', variant: 'success' },
    });
  });

  test('applies default variant', () => {
    const result = createToastBody({ message: 'Test' });
    expect(result.body.variant).toBe('info');
  });

  test('throws on invalid input', () => {
    expect(() => createToastBody({} as any)).toThrow();
    expect(() => createToastBody({ message: 123 } as any)).toThrow();
  });

  test('preserves all fields', () => {
    const result = createToastBody({
      message: 'Complete',
      variant: 'error',
      title: 'Error',
      duration: 3000,
    });
    expect(result.body).toEqual({
      message: 'Complete',
      variant: 'error',
      title: 'Error',
      duration: 3000,
    });
  });
});

describe('createAppendPromptBody', () => {
  test('wraps valid options', () => {
    const result = createAppendPromptBody({ text: 'Add this' });
    expect(result).toEqual({ body: { text: 'Add this' } });
  });

  test('throws on invalid input', () => {
    expect(() => createAppendPromptBody({} as any)).toThrow();
    expect(() => createAppendPromptBody({ text: 123 } as any)).toThrow();
  });

  test('preserves text field', () => {
    const result = createAppendPromptBody({ text: 'Preserved' });
    expect(result.body.text).toBe('Preserved');
  });
});
