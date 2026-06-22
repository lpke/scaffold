const root = document.querySelector('#app');

export function renderApp(target: Element) {
  target.innerHTML = `
    <header>
      <nav class="flex gap-5 bg-gray-200 p-5">
        <a href="/">Home</a>
        <span class="ml-auto font-bold">Vite</span>
      </nav>
    </header>
    <main class="p-5">
      <h1>Home</h1>
    </main>
  `;
}

if (root instanceof Element) {
  renderApp(root);
}
