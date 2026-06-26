<script setup lang="{{SCRIPT_LANG}}">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <nav class="flex gap-page bg-header p-page">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/about">About</RouterLink>
      <span class="ml-auto font-bold">Vue + Vite</span>
    </nav>
  </header>

  <main class="p-page">
    <RouterView />
  </main>
</template>
