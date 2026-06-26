const root = document.querySelector('#app');

export function renderApp(target) {
  target.innerHTML = `
    <header>
      <nav class="flex gap-page bg-header p-page">
        <a href="/">Home</a>
        <span class="ml-auto font-bold">Vite</span>
      </nav>
    </header>
    <main class="p-page">
      <h1>Home</h1>
    </main>
  `;
}

if (root instanceof Element) {
  renderApp(root);
}
