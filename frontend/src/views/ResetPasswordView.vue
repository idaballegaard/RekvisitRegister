<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resetPassword } from '../services/auth.service'

const route = useRoute()
const router = useRouter()
const newPassword = ref('')
const repeatedPassword = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')

async function submitReset(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''

  if (!token.value) {
    errorMessage.value = 'Nulstillingslinket mangler eller er ugyldigt.'
    return
  }
  if (newPassword.value !== repeatedPassword.value) {
    errorMessage.value = 'Adgangskoderne er ikke ens.'
    return
  }

  isSubmitting.value = true
  try {
    await resetPassword({ token: token.value, newPassword: newPassword.value })
    newPassword.value = ''
    repeatedPassword.value = ''
    successMessage.value = 'Adgangskoden er nulstillet. Du kan nu logge ind.'
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Adgangskoden kunne ikke nulstilles.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="grid min-h-screen min-h-[100svh] place-items-center bg-white px-6 font-sans text-gray-dark">
    <section class="w-full max-w-[340px]" aria-labelledby="reset-heading">
      <p class="mb-3 text-[11px] font-bold text-brand uppercase">Rekvisit Register</p>
      <h1 id="reset-heading" class="text-xl font-bold">Vælg ny adgangskode</h1>
      <p class="mt-2 mb-5 text-sm text-gray-medium">
        Vælg en adgangskode på mindst 12 tegn.
      </p>

      <form class="flex flex-col" @submit.prevent="submitReset">
        <label for="new-password" class="mb-2 text-sm">Ny adgangskode</label>
        <input
          id="new-password"
          v-model="newPassword"
          name="newPassword"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="72"
          required
          class="mb-4 h-10 rounded border border-gray-light px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand"
        />
        <label for="repeat-password" class="mb-2 text-sm">Gentag adgangskode</label>
        <input
          id="repeat-password"
          v-model="repeatedPassword"
          name="repeatPassword"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="72"
          required
          class="mb-4 h-10 rounded border border-gray-light px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand"
        />
        <p v-if="errorMessage" class="mb-3 text-sm text-brand" role="alert">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="mb-3 text-sm text-green-700" role="status">
          {{ successMessage }}
        </p>
        <button
          class="h-10 rounded bg-brand text-sm font-bold text-white disabled:opacity-60"
          type="submit"
          :disabled="isSubmitting || Boolean(successMessage)"
        >
          {{ isSubmitting ? 'Gemmer…' : 'Nulstil adgangskode' }}
        </button>
      </form>
      <button
        class="mt-4 text-sm text-brand underline"
        type="button"
        @click="router.push({ name: 'login' })"
      >
        Tilbage til login
      </button>
    </section>
  </main>
</template>
