import { describe, expect, it } from 'vitest';

describe('Node environment', () => {
  it('runs tests', () => {
    expect('document' in globalThis).toBe(false);
  });
});
