import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Home from '@/page';

describe('Home', () => {
  it('renders the home page', () => {
    expect(renderToStaticMarkup(<Home />)).toContain('Home');
  });
});
