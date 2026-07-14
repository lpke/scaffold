import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

test('handles user interaction in Chromium', async () => {
  document.body.innerHTML = '<button type="button">Count: 0</button>';

  const button = page.getByRole('button');
  button.element().addEventListener('click', () => {
    button.element().textContent = 'Count: 1';
  });

  await userEvent.click(button);

  await expect.element(button).toHaveTextContent('Count: 1');
});
