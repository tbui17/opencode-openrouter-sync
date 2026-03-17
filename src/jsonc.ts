/**
 * JSONC (JSON with Comments) stripper
 * Removes single-line (//) and block comments from JSON text
 * while preserving strings and line numbers.
 */

type State = 'normal' | 'in-string' | 'in-line-comment' | 'in-block-comment';

/**
 * Strip comments from JSONC text, preserving line numbers.
 * Replaces comment characters with spaces so error positions stay valid.
 */
export function stripJsonComments(text: string): string {
  const result: string[] = [];
  let state: State = 'normal';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    switch (state) {
      case 'normal':
        if (ch === '"') {
          state = 'in-string';
          result.push(ch);
          i++;
        } else if (ch === '/' && next === '/') {
          state = 'in-line-comment';
          result.push(' ', ' ');
          i += 2;
        } else if (ch === '/' && next === '*') {
          state = 'in-block-comment';
          result.push(' ', ' ');
          i += 2;
        } else {
          result.push(ch);
          i++;
        }
        break;

      case 'in-string':
        if (ch === '\\') {
          // Escaped character — push both and skip
          result.push(ch, next ?? '');
          i += 2;
        } else if (ch === '"') {
          state = 'normal';
          result.push(ch);
          i++;
        } else {
          result.push(ch);
          i++;
        }
        break;

      case 'in-line-comment':
        if (ch === '\n') {
          state = 'normal';
          result.push('\n');
          i++;
        } else {
          result.push(' ');
          i++;
        }
        break;

      case 'in-block-comment':
        if (ch === '*' && next === '/') {
          state = 'normal';
          result.push(' ', ' ');
          i += 2;
        } else if (ch === '\n') {
          result.push('\n');
          i++;
        } else {
          result.push(' ');
          i++;
        }
        break;
    }
  }

  let output = result.join('');

  // Strip trailing commas: comma followed by optional whitespace/newlines then ] or }
  output = output.replace(/,(\s*[\]}])/g, '$1');

  return output;
}
