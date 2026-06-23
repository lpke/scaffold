<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />

    <header>
      <nav class="site-nav">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink to="/about">About</NuxtLink>
        <span class="site-label">Vue + Nuxt</span>
      </nav>
    </header>

    <main class="page">
      <NuxtPage />
    </main>
  </div>
</template>
