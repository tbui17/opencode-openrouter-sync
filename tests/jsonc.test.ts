import { describe, test, expect } from 'bun:test';
import { stripJsonComments } from '../src/jsonc';

describe('stripJsonComments', () => {
  test('removes single-line comments', () => {
    const input = '{\n  "key": "value" // this is a comment\n}';
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  test('removes block comments', () => {
    const input = '{\n  /* block comment */\n  "key": "value"\n}';
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  test('preserves comments inside strings', () => {
    const input = '{"key": "value // not a comment", "k2": "/* also not */"}';
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({
      key: 'value // not a comment',
      k2: '/* also not */',
    });
  });

  test('handles escaped quotes inside strings', () => {
    const input = '{"key": "val\\"ue // still string"} // real comment';
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ key: 'val"ue // still string' });
  });

  test('handles mixed comments', () => {
    const input = [
      '{',
      '  // line comment',
      '  "a": 1, /* inline block */',
      '  /*',
      '   * multi-line',
      '   * block comment',
      '   */',
      '  "b": 2',
      '}',
    ].join('\n');
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ a: 1, b: 2 });
  });

  test('returns empty string for empty input', () => {
    expect(stripJsonComments('')).toBe('');
  });

  test('preserves line numbers (same number of newlines)', () => {
    const input = '{\n// comment\n/* block\ncomment */\n"key": 1\n}';
    const result = stripJsonComments(input);
    const inputLines = input.split('\n').length;
    const resultLines = result.split('\n').length;
    expect(resultLines).toBe(inputLines);
  });

  test('handles multiline block comments', () => {
    const input = '{\n/*\n  "removed": true\n*/\n  "kept": true\n}';
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ kept: true });
  });

  test('handles unterminated block comment gracefully', () => {
    const input = '{"key": "value"} /* unterminated';
    const result = stripJsonComments(input);
    // Should not throw; the unterminated comment is just stripped
    expect(result).toContain('"key"');
    expect(result).not.toContain('/*');
    expect(result).not.toContain('unterminated');
  });

  test('handles text with no comments', () => {
    const input = '{"key": "value", "num": 42}';
    const result = stripJsonComments(input);
    expect(result).toBe(input);
  });

  test('handles consecutive slashes that are not comments', () => {
    // A single slash is not a comment opener
    const input = '{"url": "https://example.com"}';
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ url: 'https://example.com' });
  });
});
