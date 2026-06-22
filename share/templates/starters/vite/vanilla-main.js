const root = document.querySelector('#app');

export function renderApp(target) {
  target.innerHTML = `
    <div class="app-shell">
      <header>
        <nav class="site-nav">
          <a href="/">Home</a>
          <span class="site-label">Vite</span>
        </nav>
      </header>
      <main class="page">
        <h1>Home</h1>
      </main>
    </div>
  `;
}

if (root instanceof Element) {
  renderApp(root);
}
