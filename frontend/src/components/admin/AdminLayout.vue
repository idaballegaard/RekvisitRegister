<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { AdminTab } from '../../composables/admin/adminTypes'
import { roleNames } from '../../composables/admin/roleNames'
import { clearAuthSession, type CurrentUserProfile } from '../../services/auth.service'

defineProps<{
  profile: CurrentUserProfile | null
  associationName?: string
  activeTab: AdminTab
  propPage?: boolean
}>()
const emit = defineEmits<{ selectTab: [tab: AdminTab] }>()
const router = useRouter()

async function logout(): Promise<void> {
  clearAuthSession()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="admin-surface min-h-screen min-h-[100svh] bg-white font-sans text-gray-dark">
    <main class="mx-auto w-full max-w-[1440px] px-5 pt-[68px] pb-8 sm:px-8 max-[700px]:pt-6">
      <header class="border-b border-[#e2e0e0] pb-[22px]">
        <div class="flex items-start justify-between gap-6">
          <div>
            <p class="mb-2 text-base font-bold tracking-[0.16em] text-brand uppercase">
              {{ associationName ?? profile?.associationName ?? 'Forening' }}
            </p>
            <h1 class="text-4xl leading-[1.15] font-bold max-[540px]:text-3xl">
              {{ !propPage && profile?.role === 'propManager' ? 'Rekvisitoversigt' : 'Adminpanel' }}
            </h1>
            <p class="mt-3 text-lg text-gray-medium">
              {{ !propPage && profile?.role === 'propManager'
                ? 'Find og slet foreningens rekvisitter.'
                : 'Administrér din forenings oplysninger, rekvisitter og lån.' }}
            </p>
          </div>
          <p v-if="profile" class="mt-4 text-sm text-gray-medium max-[540px]:hidden">
            {{ roleNames[profile.role] }}
          </p>
        </div>
        <slot name="header-status" />
      </header>

      <nav class="border-b border-[#e2e0e0]" aria-label="Adminpanel-faner">
        <ul class="-mb-px flex flex-wrap gap-8 max-[540px]:gap-6">
          <li v-if="profile?.role === 'associationAdmin' || (profile?.role === 'propManager' && !propPage)">
            <button
              class="inline-flex h-[54px] items-center border-b-2 px-0.5 text-base"
              :class="activeTab === 'general'
                ? 'border-brand font-bold text-brand'
                : 'border-transparent text-gray-medium hover:text-brand'"
              :aria-current="activeTab === 'general' ? 'page' : undefined"
              type="button"
              @click="emit('selectTab', 'general')"
            >
              Generelt
            </button>
          </li>
          <li v-if="profile?.role === 'associationAdmin' || profile?.role === 'propManager'">
            <button
              class="inline-flex h-[54px] items-center border-b-2 px-0.5 text-base"
              :class="activeTab === 'props'
                ? 'border-brand font-bold text-brand'
                : 'border-transparent text-gray-medium hover:text-brand'"
              :aria-current="activeTab === 'props' ? 'page' : undefined"
              type="button"
              @click="emit('selectTab', 'props')"
            >
              Egne rekvisitter
            </button>
          </li>
          <li v-if="profile?.role === 'associationAdmin'">
            <button
              :class="propPage
                ? 'h-[54px] cursor-not-allowed px-0.5 text-base text-gray-medium/60'
                : [
                    'inline-flex h-[54px] items-center border-b-2 px-0.5 text-base',
                    activeTab === 'users'
                      ? 'border-brand font-bold text-brand'
                      : 'border-transparent text-gray-medium hover:text-brand',
                  ]"
              :aria-current="!propPage && activeTab === 'users' ? 'page' : undefined"
              type="button"
              :disabled="propPage"
              :title="propPage ? 'Denne fane er ikke tilgængelig endnu' : undefined"
              @click="emit('selectTab', 'users')"
            >
              Brugere
            </button>
          </li>
          <li v-if="profile?.role === 'associationAdmin' || profile?.role === 'propManager'">
            <button
              class="inline-flex h-[54px] items-center border-b-2 px-0.5 text-base"
              :class="activeTab === 'loans'
                ? 'border-brand font-bold text-brand'
                : 'border-transparent text-gray-medium hover:text-brand'"
              :aria-current="activeTab === 'loans' ? 'page' : undefined"
              type="button"
              @click="emit('selectTab', 'loans')"
            >
              Lån
            </button>
          </li>
        </ul>
      </nav>

      <slot />

      <footer class="flex justify-end border-t border-[#e2e0e0] pt-4" :class="{ 'mt-8': propPage }">
        <button
          class="flex h-11 shrink-0 items-center gap-4 rounded-[4px] border-0 bg-brand px-5 text-base font-semibold text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          type="button"
          aria-label="Log ud"
          @click="logout"
        >
          Log ud <span aria-hidden="true">→</span>
        </button>
      </footer>
    </main>
  </div>
</template>
