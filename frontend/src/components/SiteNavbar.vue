<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { currentUserRole } from '../services/auth.service'

const route = useRoute()
const menuOpen = ref(false)
const navigation = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)
let mobileQuery: MediaQueryList | undefined
const activeSection = computed(() => {
  if (route.name === 'profile') return 'profile'
  if (route.name === 'admin' || route.name === 'admin-prop-create' || route.name === 'admin-prop-detail') {
    return 'admin'
  }
  return null
})

function closeMenu(): void {
  menuOpen.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && menuOpen.value) {
    closeMenu()
    void nextTick(() => menuButton.value?.focus())
  }
}

function onPointerDown(event: PointerEvent): void {
  if (menuOpen.value && event.target instanceof Node && !navigation.value?.contains(event.target)) {
    closeMenu()
  }
}

function onViewportChange(event: MediaQueryListEvent): void {
  if (!event.matches) closeMenu()
}

watch(() => route.fullPath, closeMenu)
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
  mobileQuery = window.matchMedia?.('(width < 700px)')
  mobileQuery?.addEventListener('change', onViewportChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
  mobileQuery?.removeEventListener('change', onViewportChange)
})
</script>

<template>
  <header class="border-t-[6px] border-brand border-b border-b-[#e2e0e0] bg-white font-sans">
    <nav
      ref="navigation"
      class="relative flex min-h-[88px] items-center justify-between gap-x-8 px-8 max-[700px]:min-h-[68px] max-[700px]:gap-x-4 max-[700px]:px-5"
      aria-label="Hovednavigation"
    >
      <span class="shrink-0 py-4 text-[26px] leading-tight font-bold text-brand">
        Rekvisit Register
      </span>
      <button
        ref="menuButton"
        type="button"
        class="hidden size-11 shrink-0 items-center justify-center rounded text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-[700px]:inline-flex"
        :aria-label="menuOpen ? 'Luk menu' : 'Åbn menu'"
        :aria-expanded="menuOpen"
        aria-controls="site-navigation-links"
        @click="menuOpen = !menuOpen"
      >
        <svg v-if="!menuOpen" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        <svg v-else width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M5 5l14 14M19 5 5 19" />
        </svg>
      </button>
      <div
        id="site-navigation-links"
        class="flex flex-wrap items-center gap-x-7 max-[700px]:absolute max-[700px]:top-full max-[700px]:right-5 max-[700px]:z-50 max-[700px]:w-[min(18rem,calc(100vw-2.5rem))] max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-0 max-[700px]:rounded max-[700px]:border max-[700px]:border-[#e2e0e0] max-[700px]:bg-white max-[700px]:p-3 max-[700px]:shadow-lg"
        :class="menuOpen ? 'max-[700px]:flex' : 'max-[700px]:hidden'"
      >
        <span
          aria-disabled="true"
          title="Rekvisitsiden er ikke tilgængelig endnu"
          class="inline-flex min-h-[56px] items-center border-b-[3px] border-transparent text-lg text-gray-medium max-[700px]:min-h-11 max-[700px]:px-3"
        >
          Rekvisitter
        </span>
        <span
          aria-disabled="true"
          title="Teaterforeninger er ikke tilgængelig endnu"
          class="inline-flex min-h-[56px] items-center border-b-[3px] border-transparent text-lg text-gray-medium max-[700px]:min-h-11 max-[700px]:px-3"
        >
          Teaterforeninger
        </span>
        <RouterLink
          v-if="currentUserRole === 'associationAdmin' || currentUserRole === 'propManager'"
          :to="{ name: 'admin' }"
          :aria-current="activeSection === 'admin' ? 'page' : undefined"
          class="inline-flex min-h-[56px] items-center border-b-[3px] text-lg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-[700px]:min-h-11 max-[700px]:px-3"
          :class="activeSection === 'admin'
            ? 'border-brand font-bold text-brand'
            : 'border-transparent text-gray-medium hover:text-brand'"
          @click="closeMenu"
        >
          Adminpanel
        </RouterLink>
        <RouterLink
          :to="{ name: 'profile' }"
          :aria-current="activeSection === 'profile' ? 'page' : undefined"
          class="inline-flex min-h-[56px] items-center gap-2 border-b-[3px] text-lg no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-[700px]:min-h-11 max-[700px]:px-3"
          :class="activeSection === 'profile'
            ? 'border-brand font-bold text-brand'
            : 'border-transparent text-gray-medium hover:text-brand'"
          @click="closeMenu"
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
