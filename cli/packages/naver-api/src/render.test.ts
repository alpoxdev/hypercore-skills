import { describe, expect, it } from 'vitest';

import { renderJson, renderRelativeIndexChart, renderTable } from './render.js';

describe('terminal rendering', () => {
  it('removes terminal controls and flattens layout controls in table output', () => {
    const output = renderTable([{ 'na\u001b[31mme\u001b[0m': 'one\ttwo\nthree\u0000' }]);

    expect(output).toContain('name');
    expect(output).toContain('one two three');
    expect(
      [...output].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 8 || (code >= 11 && code <= 31) || (code >= 127 && code <= 159);
      }),
    ).toBe(false);
  });

  it('sanitizes trend labels while preserving JSON values', () => {
    const value = 'title\n\u001b[2J\tvalue';

    expect(renderRelativeIndexChart(value, [])).toBe('title value\n(no data)');
    expect(renderJson('trends', { value })).toContain(JSON.stringify(value));
  });
  it('removes only NAVER highlight tags from human tables while preserving JSON source', () => {
    const value = '<b>coffee</b> <i>guide</i>';

    expect(renderTable([{ title: value }])).toContain('coffee <i>guide</i>');
    expect(renderJson('search', { title: value })).toContain(value);
  });
});
