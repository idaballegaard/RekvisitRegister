<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'
import { currentUserRole } from '../services/auth.service'

const route = useRoute()
const activeSection = computed(() => {
  if (route.name === 'profile') return 'profile'
  if (route.name === 'admin' || route.name === 'admin-prop-create' || route.name === 'admin-prop-detail') {
    return 'admin'
  }
  return null
})
</script>

<template>
  <header class="border-t-[6px] border-brand border-b border-b-[#e2e0e0] bg-white font-sans">
    <nav
      class="flex min-h-[88px] items-center justify-between gap-x-8 px-8 max-[700px]:flex-wrap max-[700px]:gap-x-4 max-[700px]:px-5"
      aria-label="Hovednavigation"
    >
      <span class="shrink-0 py-4 text-[26px] leading-tight font-bold text-brand">
        Rekvisit Register
      </span>
      <div class="flex flex-wrap items-center gap-x-7 max-[700px]:w-full max-[700px]:gap-x-5">
        <span
          aria-disabled="true"
          title="Rekvisitsiden er ikke tilgængelig endnu"
          class="inline-flex min-h-[56px] items-center border-b-[3px] border-transparent text-lg text-gray-medium"
        >
          Rekvisitter
        </span>
        <span
          aria-disabled="true"
          title="Teaterforeninger er ikke tilgængelig endnu"
          class="inline-flex min-h-[56px] items-center border-b-[3px] border-transparent text-lg text-gray-medium"
        >
          Teaterforeninger
        </span>
        <RouterLink
          v-if="currentUserRole === 'associationAdmin' || currentUserRole === 'propManager'"
          :to="{ name: 'admin' }"
          :aria-current="activeSection === 'admin' ? 'page' : undefined"
          class="inline-flex min-h-[56px] items-center border-b-[3px] text-lg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          :class="activeSection === 'admin'
            ? 'border-brand font-bold text-brand'
            : 'border-transparent text-gray-medium hover:text-brand'"
        >
          Adminpanel
        </RouterLink>
        <RouterLink
          :to="{ name: 'profile' }"
          :aria-current="activeSection === 'profile' ? 'page' : undefined"
          class="inline-flex min-h-[56px] items-center gap-2 border-b-[3px] text-lg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          :class="activeSection === 'profile'
            ? 'border-brand font-bold text-brand'
            : 'border-transparent text-gray-medium hover:text-brand'"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
          </svg>
          Profil
        </RouterLink>
      </div>
    </nav>
  </header>
</template>
