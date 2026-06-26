<template>
  <div class="flex min-h-full flex-col">
    <NuxtRouteAnnouncer />

    <header>
      <nav class="flex gap-page bg-header p-page">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink to="/about">About</NuxtLink>
        <span class="ml-auto font-bold">Vue + Nuxt</span>
      </nav>
    </header>

    <main class="p-page">
      <NuxtPage />
    </main>
  </div>
</template>
