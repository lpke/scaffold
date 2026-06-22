import { createApp } from 'vue';
import { describe, expect, it } from 'vitest';
import App from './App.vue';

describe('App', () => {
  it('renders the home page', () => {
    const target = document.createElement('div');
    const app = createApp(App);

    app.mount(target);

    expect(target.textContent).toContain('Home');
    app.unmount();
  });
});
