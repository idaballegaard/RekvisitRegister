<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  clearAuthSession,
  getCurrentUser,
  UnauthorizedError,
  type CurrentUserProfile,
} from '../services/auth.service'

const router = useRouter()
const currentPasswordVisible = ref(false)
const newPasswordVisible = ref(false)
const repeatedPasswordVisible = ref(false)
const profile = ref<CurrentUserProfile | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')
const roleNames: Record<CurrentUserProfile['role'], string> = {
  associationAdmin: 'Foreningsansvarlig',
  propManager: 'Rekvisitansvarlig',
  searchUser: 'Søgebruger',
}

async function logout(): Promise<void> {
  clearAuthSession()
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  try {
    profile.value = await getCurrentUser()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Profilen kunne ikke hentes.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen min-h-[100svh] bg-white font-sans text-gray-dark">
    <main class="px-[4.3%] pt-[27px] pb-8 max-[540px]:px-5 max-[540px]:pt-6">
      <header class="border-b border-[#e2e0e0] pb-[22px]">
        <p class="mb-1.5 text-[10px] font-bold tracking-[0.16em] text-brand uppercase">
          Din konto
        </p>
        <h1 class="text-2xl leading-[1.2] font-bold">Min profil</h1>
        <p class="mt-2 text-xs text-gray-medium">Se og opdatér dine personlige oplysninger.</p>
        <p v-if="isLoading" class="mt-4 text-xs text-gray-medium" role="status">
          Henter profil…
        </p>
        <p v-else-if="errorMessage" class="mt-4 text-xs text-brand" role="alert">
          {{ errorMessage }}
        </p>

        <div v-if="profile" class="mt-[23px] flex items-center gap-3">
          <div
            class="grid size-[38px] shrink-0 place-items-center rounded-full bg-[#f5eded] text-base text-brand"
            aria-hidden="true"
          >
            {{ profile.firstName.charAt(0).toUpperCase() }}
          </div>
          <div>
            <p class="text-sm font-bold">{{ profile.firstName }} {{ profile.lastName }}</p>
            <p class="mt-1 text-[11px] text-gray-medium">
              {{ profile.associationName }} · {{ roleNames[profile.role] }}
            </p>
          </div>
        </div>
      </header>

      <div
        v-if="profile"
        class="grid grid-cols-2 justify-between gap-x-8 gap-y-10 border-b border-[#e2e0e0] py-[25px] max-[700px]:grid-cols-1"
      >
        <section class="w-full max-w-[340px]" aria-labelledby="personal-heading">
          <h2 id="personal-heading" class="mb-[17px] text-sm font-bold text-brand">
            Personlige oplysninger
          </h2>
          <form class="flex flex-col">
            <label for="profile-name" class="mb-[7px] text-xs">Navn</label>
            <input
              id="profile-name"
              name="name"
              type="text"
              :value="`${profile.firstName} ${profile.lastName}`"
              autocomplete="name"
              class="mb-[14px] h-[35px] w-full rounded-[4px] border border-gray-light bg-white px-[9px] text-xs text-gray-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />

            <label for="profile-email" class="mb-[7px] text-xs">E-mail</label>
            <input
              id="profile-email"
              name="email"
              type="email"
              placeholder="Ikke angivet"
              autocomplete="email"
              readonly
              class="h-[35px] w-full rounded-[4px] border border-gray-light bg-white px-[9px] text-xs text-gray-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
            <p class="mt-[7px] text-[11px] text-gray-medium">
              E-mail er ikke registreret på kontoen endnu.
            </p>
            <button
              class="mt-[17px] h-[35px] w-fit rounded-[4px] border-0 bg-brand px-[14px] text-xs text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              type="button"
            >
              Gem ændringer
            </button>
          </form>
        </section>

        <section class="w-full max-w-[340px]" aria-labelledby="password-heading">
          <h2 id="password-heading" class="mb-[9px] text-sm font-bold text-brand">
            Adgangskode
          </h2>
          <p class="mb-[17px] text-xs text-gray-medium">Du kan ændre din adgangskode her.</p>

          <form class="flex flex-col">
            <label for="current-password" class="mb-[7px] text-xs">Nuværende adgangskode</label>
            <div class="relative mb-[14px]">
              <input
                id="current-password"
                name="currentPassword"
                :type="currentPasswordVisible ? 'text' : 'password'"
                autocomplete="current-password"
                class="h-[35px] w-full rounded-[4px] border border-gray-light bg-white py-0 pr-[52px] pl-[9px] text-xs text-gray-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
              <button
                class="absolute inset-y-0 right-0 px-[11px] text-[11px] text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                type="button"
                :aria-label="currentPasswordVisible ? 'Skjul nuværende adgangskode' : 'Vis nuværende adgangskode'"
                @click="currentPasswordVisible = !currentPasswordVisible"
              >
                {{ currentPasswordVisible ? 'Skjul' : 'Vis' }}
              </button>
            </div>

            <label for="new-password" class="mb-[7px] text-xs">Ny adgangskode</label>
            <div class="relative mb-[14px]">
              <input
                id="new-password"
                name="newPassword"
                :type="newPasswordVisible ? 'text' : 'password'"
                autocomplete="new-password"
                class="h-[35px] w-full rounded-[4px] border border-gray-light bg-white py-0 pr-[52px] pl-[9px] text-xs text-gray-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
              <button
                class="absolute inset-y-0 right-0 px-[11px] text-[11px] text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                type="button"
                :aria-label="newPasswordVisible ? 'Skjul ny adgangskode' : 'Vis ny adgangskode'"
                @click="newPasswordVisible = !newPasswordVisible"
              >
                {{ newPasswordVisible ? 'Skjul' : 'Vis' }}
              </button>
            </div>

            <label for="repeat-password" class="mb-[7px] text-xs">Gentag ny adgangskode</label>
            <div class="relative">
              <input
                id="repeat-password"
                name="repeatPassword"
                :type="repeatedPasswordVisible ? 'text' : 'password'"
                autocomplete="new-password"
                class="h-[35px] w-full rounded-[4px] border border-gray-light bg-white py-0 pr-[52px] pl-[9px] text-xs text-gray-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
              <button
                class="absolute inset-y-0 right-0 px-[11px] text-[11px] text-gray-dark focus-visible:outline-2 focus-visible:outline-brand"
                type="button"
                :aria-label="repeatedPasswordVisible ? 'Skjul gentaget adgangskode' : 'Vis gentaget adgangskode'"
                @click="repeatedPasswordVisible = !repeatedPasswordVisible"
              >
                {{ repeatedPasswordVisible ? 'Skjul' : 'Vis' }}
              </button>
            </div>

            <button
              class="mt-[17px] h-[35px] w-fit rounded-[4px] border-0 bg-brand px-[14px] text-xs text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              type="button"
            >
              Opdatér adgangskode
            </button>
          </form>
        </section>
      </div>

      <section
        v-if="profile"
        class="border-b border-[#e2e0e0] py-[21px]"
        aria-labelledby="association-heading"
      >
        <h2 id="association-heading" class="mb-[17px] text-sm font-bold text-brand">
          Forening og rolle
        </h2>
        <dl class="grid max-w-[570px] grid-cols-2 gap-8 max-[540px]:grid-cols-1 max-[540px]:gap-4">
          <div>
            <dt class="mb-[5px] text-[11px] text-gray-medium">Forening</dt>
            <dd class="text-xs">{{ profile.associationName }}</dd>
          </div>
          <div>
            <dt class="mb-[5px] text-[11px] text-gray-medium">Rolle</dt>
            <dd class="text-xs">{{ roleNames[profile.role] }}</dd>
          </div>
        </dl>
        <p class="mt-[14px] text-[11px] text-gray-medium">
          Din rolle bestemmer, hvilke funktioner du har adgang til. Den kan ikke ændres fra profilsiden.
        </p>
      </section>

      <footer
        v-if="profile"
        class="flex items-center justify-between gap-5 pt-[17px] max-[540px]:items-start max-[540px]:flex-col"
      >
        <p class="text-[11px] text-gray-medium">
          Bruger du en fælles computer? Husk at logge ud, når du er færdig.
        </p>
        <button
          class="flex h-[35px] shrink-0 items-center gap-4 rounded-[4px] border-0 bg-brand px-[14px] text-xs text-white hover:bg-[#7d0202] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
