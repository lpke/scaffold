<template>
  <div class="flex min-h-full flex-col">
    <NuxtRouteAnnouncer />

    <header>
      <nav class="flex gap-5 bg-emerald-200 p-5">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink to="/about">About</NuxtLink>
        <span class="ml-auto font-bold">Vue + Nuxt</span>
      </nav>
    </header>

    <main class="p-5">
      <NuxtPage />
    </main>
  </div>
</template>
