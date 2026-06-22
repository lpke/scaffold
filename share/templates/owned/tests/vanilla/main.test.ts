import { describe, expect, it } from 'vitest';
import { renderApp } from './main';

describe('renderApp', () => {
  it('renders the home page', () => {
    const target = document.createElement('div');

    renderApp(target);

    expect(target.querySelector('h1')?.textContent).toBe('Home');
  });
});
