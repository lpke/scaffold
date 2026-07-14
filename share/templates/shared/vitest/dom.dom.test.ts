import { describe, expect, it } from 'vitest';

describe('jsdom environment', () => {
  it('provides browser DOM APIs', () => {
    const element = document.createElement('p');
    element.textContent = 'jsdom';

    expect(element.textContent).toBe('jsdom');
  });
});
