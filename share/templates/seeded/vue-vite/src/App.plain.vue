<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <nav class="site-nav">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/about">About</RouterLink>
      <span class="site-label">Vue + Vite</span>
    </nav>
  </header>

  <main class="page">
    <RouterView />
  </main>
</template>
