import { createApp } from 'vue';
import { describe, expect, it } from 'vitest';
import HomePage from './index.vue';

describe('Home page', () => {
  it('renders the home page', () => {
    const target = document.createElement('div');
    const app = createApp(HomePage);

    app.mount(target);

    expect(target.textContent).toContain('Home');
    app.unmount();
  });
});
